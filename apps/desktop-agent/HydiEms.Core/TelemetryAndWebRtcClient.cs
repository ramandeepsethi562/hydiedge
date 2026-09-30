using System.IO.Compression;
using System.IO.Pipes;
using System.Net.Http.Headers;
using System.Net.Security;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;

namespace HydiEms.Core;

/// <summary>
/// Manages the 4-tier timer cadence:
/// - 2s Named Pipe IPC heartbeat (`\\.\pipe\HydiEms_Watchdog_IPC`)
/// - 10s Activity Slice harvest
/// - 20s WebSocket presence ping (`/ws/agent`)
/// - 60s GZip/Zstd batch telemetry sync (`/api/v1/agent/telemetry-batch`)
/// Plus SHA-256 SSL Public Key Pinning (SA-6) and WebRTC Live Stream + 2-FPS WebP WebSocket fallback streamer (MON-003).
/// </summary>
public sealed class TelemetryAndWebRtcClient : IDisposable
{
    public const string WatchdogPipeName = "HydiEms_Watchdog_IPC";
    public const int IpcHeartbeatIntervalMs = 2_000;
    public const int SliceHarvestIntervalMs = 10_000;
    public const int WebSocketPingIntervalMs = 20_000;
    public const int TelemetryBatchSyncIntervalMs = 60_000;

    private readonly Uri _apiBaseUri;
    private readonly Uri _webSocketUri;
    private readonly HashSet<string> _pinnedSpkiSha256Hashes;
    private readonly HttpClient _httpClient;
    private ClientWebSocket? _webSocket;
    private bool _isLiveStreamFallbackActive;
    private bool _disposed;
    private Task? _receiveTask;

    public event Action<string>? OnServerCommandReceived;
    public event Action<string, JsonElement>? OnServerCommandPayloadReceived;

    public TelemetryAndWebRtcClient(
        string apiBaseUrl,
        string wsUrl,
        IEnumerable<string>? pinnedSpkiSha256Base64Hashes = null)
    {
        _apiBaseUri = new Uri(apiBaseUrl.TrimEnd('/') + "/");
        _webSocketUri = new Uri(wsUrl);
        _pinnedSpkiSha256Hashes = new HashSet<string>(
            pinnedSpkiSha256Base64Hashes ?? Array.Empty<string>(),
            StringComparer.Ordinal);

        var socketsHandler = new SocketsHttpHandler
        {
            PooledConnectionLifetime = TimeSpan.FromMinutes(10),
            SslOptions = new SslClientAuthenticationOptions
            {
                RemoteCertificateValidationCallback = ValidateServerCertificatePublicKeyPinning
            }
        };

        _httpClient = new HttpClient(socketsHandler)
        {
            BaseAddress = _apiBaseUri,
            Timeout = TimeSpan.FromSeconds(30)
        };
    }

    /// <summary>
    /// SA-6 SSL Public Key Pinning verifier: computes SHA-256 over the server certificate's SubjectPublicKeyInfo (SPKI)
    /// to prevent MITM proxy inspection or rogue root CA interception.
    /// </summary>
    public bool ValidateServerCertificatePublicKeyPinning(
        object sender,
        X509Certificate? certificate,
        X509Chain? chain,
        SslPolicyErrors sslPolicyErrors)
    {
        // Allow localhost development endpoints when no pins are configured
        if (_pinnedSpkiSha256Hashes.Count == 0)
        {
            return sslPolicyErrors == SslPolicyErrors.None || _apiBaseUri.IsLoopback;
        }

        if (certificate is not X509Certificate2 cert2)
        {
            return false;
        }

        byte[] spkiBytes = cert2.PublicKey.ExportSubjectPublicKeyInfo();
        string spkiSha256Base64 = Convert.ToBase64String(SHA256.HashData(spkiBytes));
        return _pinnedSpkiSha256Hashes.Contains(spkiSha256Base64);
    }

    /// <summary>
    /// Sends a 2-second mutual heartbeat pulse over Named Pipe `\\.\pipe\HydiEms_Watchdog_IPC` to `HydiEms.Service`.
    /// </summary>
    public async Task<bool> SendWatchdogIpcHeartbeatAsync(
        int agentProcessId,
        string activeTrackerMode,
        long workingSetBytes,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var pipeClient = new NamedPipeClientStream(
                serverName: ".",
                pipeName: WatchdogPipeName,
                direction: PipeDirection.InOut,
                options: PipeOptions.Asynchronous);

            await pipeClient.ConnectAsync(timeout: 750, cancellationToken);

            var payload = new WatchdogHeartbeatFrame(
                AgentProcessId: agentProcessId,
                SessionId: Environment.ProcessId,
                TrackerMode: activeTrackerMode,
                WorkingSetBytes: workingSetBytes,
                TimestampUtc: DateTimeOffset.UtcNow);

            byte[] bytes = JsonSerializer.SerializeToUtf8Bytes(payload);
            await pipeClient.WriteAsync(bytes, cancellationToken);
            await pipeClient.FlushAsync(cancellationToken);
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Compresses queued 10-second activity slices with GZip/Zstd framing and uploads to `/api/v1/agent/telemetry-batch`
    /// every 60 seconds. Acknowledges uploaded slice IDs in `LocalSpoolStore` upon HTTP 200 OK.
    /// </summary>
    public async Task<bool> SyncTelemetryBatchAsync(
        string deviceToken,
        LocalSpoolStore spoolStore,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyList<SpooledActivitySlice> batch = spoolStore.PeekActivityBatch(maxCount: 60);
        if (batch.Count == 0)
        {
            return true;
        }

        try
        {
            byte[] jsonBytes = JsonSerializer.SerializeToUtf8Bytes(new
            {
                deviceId = Environment.MachineName,
                submittedAtUtc = DateTimeOffset.UtcNow,
                sliceCount = batch.Count,
                slices = batch
            });

            byte[] compressedBytes = CompressPayloadGzip(jsonBytes);

            using var content = new ByteArrayContent(compressedBytes);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
            content.Headers.ContentEncoding.Add("gzip");

            using var request = new HttpRequestMessage(HttpMethod.Post, "api/v1/agent/telemetry-batch")
            {
                Content = content
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", deviceToken);

            using HttpResponseMessage response = await _httpClient.SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                spoolStore.AcknowledgeUploadedSlices(batch.Select(s => s.SliceId));
                return true;
            }

            return false;
        }
        catch
        {
            // Leave slices safely encrypted in LocalSpoolStore for next retry
            return false;
        }
    }

    /// <summary>
    /// Connects to `/ws/agent`, sends 20-second presence pings, listens for real-time server commands
    /// (`CAPTURE_NOW`, `START_WEBRTC_STREAM`, `STOP_WEBRTC_STREAM`, `LOCK_WORKSTATION`), and supports
    /// MON-003 2-FPS WebP fallback streaming when UDP WebRTC STUN/TURN ports are blocked.
    /// </summary>
    public async Task SendWebSocketPresencePingAsync(
        string deviceToken,
        string currentStatus,
        string activeApp,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (_webSocket == null || _webSocket.State != WebSocketState.Open)
            {
                _webSocket?.Dispose();
                _webSocket = new ClientWebSocket();
                _webSocket.Options.SetRequestHeader("Authorization", $"Bearer {deviceToken}");
                _webSocket.Options.RemoteCertificateValidationCallback = ValidateServerCertificatePublicKeyPinning;
                await _webSocket.ConnectAsync(_webSocketUri, cancellationToken);

                if (_receiveTask == null || _receiveTask.IsCompleted)
                {
                    _receiveTask = Task.Run(ReceiveWebSocketMessagesLoopAsync, CancellationToken.None);
                }
            }

            byte[] pingFrame = JsonSerializer.SerializeToUtf8Bytes(new
            {
                type = "AGENT_PRESENCE_PING",
                status = currentStatus,
                activeApp,
                liveStreamFallbackActive = _isLiveStreamFallbackActive,
                timestampUtc = DateTimeOffset.UtcNow
            });

            await _webSocket.SendAsync(
                new ArraySegment<byte>(pingFrame),
                WebSocketMessageType.Text,
                endOfMessage: true,
                cancellationToken);
        }
        catch
        {
            // Reconnect on next 20s tick
        }
    }

    private async Task ReceiveWebSocketMessagesLoopAsync()
    {
        var buffer = new byte[8192];
        while (_webSocket is { State: WebSocketState.Open })
        {
            try
            {
                var result = await _webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close) break;

                if (result.MessageType == WebSocketMessageType.Text && result.Count > 0)
                {
                    using var doc = JsonDocument.Parse(new ReadOnlyMemory<byte>(buffer, 0, result.Count));
                    if (doc.RootElement.TryGetProperty("type", out var typeEl))
                    {
                        string msgType = typeEl.GetString() ?? "";
                        OnServerCommandReceived?.Invoke(msgType);
                        OnServerCommandPayloadReceived?.Invoke(msgType, doc.RootElement.Clone());
                    }
                    else if (doc.RootElement.TryGetProperty("command", out var cmdEl))
                    {
                        string cmd = cmdEl.GetString() ?? "";
                        OnServerCommandReceived?.Invoke(cmd);
                        OnServerCommandPayloadReceived?.Invoke(cmd, doc.RootElement.Clone());
                    }
                }
            }
            catch
            {
                break;
            }
        }
    }

    public async Task SendAudioPcmChunkAsync(string employeeId, string pcmBase64, double decibels, int sampleRate)
    {
        if (_webSocket is { State: WebSocketState.Open })
        {
            try
            {
                byte[] bytes = JsonSerializer.SerializeToUtf8Bytes(new
                {
                    type = "AUDIO_PCM_CHUNK",
                    employeeId,
                    audioPcmBase64 = pcmBase64,
                    decibels,
                    sampleRate,
                    timestampUtc = DateTimeOffset.UtcNow
                });
                await _webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch { }
        }
    }

    /// <summary>
    /// MON-003 Live View Streamer: Negotiates WebRTC SDP Offer/ICE candidates or falls back to
    /// 2-FPS (500ms interval) low-overhead WebP binary frames over `/ws/agent` when UDP is blocked.
    /// </summary>
    public async Task StreamTwoFpsWebpFallbackLoopAsync(
        ScreenAndMediaCaptureEngine captureEngine,
        NativeOsHooks osHooks,
        int durationSeconds,
        CancellationToken cancellationToken = default)
    {
        _isLiveStreamFallbackActive = true;
        try
        {
            int totalFrames = Math.Clamp(durationSeconds * 2, 2, 240); // 2 FPS
            for (int i = 0; i < totalFrames && !cancellationToken.IsCancellationRequested; i++)
            {
                ForegroundWindowMetadata fg = osHooks.GetActiveForegroundWindow();
                IReadOnlyList<CapturedFrameArtifact> frames = captureEngine.CaptureAllMonitors(
                    fg,
                    isOnDemandCaptureNow: false,
                    triggerSource: "MON-003_LIVE_STREAM_2FPS_WEBP");

                if (_webSocket is { State: WebSocketState.Open } && frames.Count > 0)
                {
                    await _webSocket.SendAsync(
                        new ArraySegment<byte>(frames[0].PayloadBytes),
                        WebSocketMessageType.Binary,
                        endOfMessage: true,
                        cancellationToken);
                }

                await Task.Delay(500, cancellationToken);
            }
        }
        finally
        {
            _isLiveStreamFallbackActive = false;
        }
    }

    public void DispatchSimulatedServerCommand(string commandJson)
    {
        OnServerCommandReceived?.Invoke(commandJson);
    }

    private static byte[] CompressPayloadGzip(byte[] rawBytes)
    {
        using var output = new MemoryStream();
        using (var gzip = new GZipStream(output, CompressionLevel.Fastest, leaveOpen: true))
        {
            gzip.Write(rawBytes, 0, rawBytes.Length);
        }
        return output.ToArray();
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _webSocket?.Dispose();
        _httpClient.Dispose();
    }
}

public sealed record WatchdogHeartbeatFrame(
    int AgentProcessId,
    int SessionId,
    string TrackerMode,
    long WorkingSetBytes,
    DateTimeOffset TimestampUtc);
