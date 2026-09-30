using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace HydiEms.Core;

/// <summary>
/// AES-256-GCM encrypted local ring-buffer spool (agent_spool.db / WAL journal) supporting 7+ days of
/// offline telemetry buffering (activity_slice_queue, media_upload_queue, security_event_queue, local_config_cache),
/// monotonic clock-tamper drift detection (Stopwatch.GetTimestamp()), and FIFO auto-pruning.
/// </summary>
public sealed class LocalSpoolStore : IDisposable
{
    public const int MaxOfflineRetentionDays = 7;
    public const int MaxActivitySliceCapacity = 60_480; // 7 days * 8640 10-second slices/day
    public const int MaxMediaQueueCapacity = 2_500;
    public const int MaxSecurityEventCapacity = 5_000;

    private readonly string _spoolFilePath;
    private readonly byte[] _aes256Key;
    private readonly Lock _syncLock = new();

    private readonly LinkedList<SpooledActivitySlice> _activitySliceQueue = new();
    private readonly LinkedList<SpooledMediaUploadItem> _mediaUploadQueue = new();
    private readonly LinkedList<SpooledSecurityEvent> _securityEventQueue = new();
    private readonly Dictionary<string, string> _localConfigCache = new(StringComparer.OrdinalIgnoreCase);

    // Monotonic clock baseline to detect user tampering with OS wall clock while offline
    private readonly DateTimeOffset _anchorWallClockUtc;
    private readonly long _anchorStopwatchTimestamp;
    private bool _disposed;

    public LocalSpoolStore(string spoolDirectory, byte[]? machineEntropyKey = null)
    {
        Directory.CreateDirectory(spoolDirectory);
        _spoolFilePath = Path.Combine(spoolDirectory, "agent_spool.db.wal");
        _aes256Key = DeriveMachineBoundAes256Key(machineEntropyKey);

        _anchorWallClockUtc = DateTimeOffset.UtcNow;
        _anchorStopwatchTimestamp = Stopwatch.GetTimestamp();

        LoadEncryptedWalFromDisk();
    }

    /// <summary>
    /// Computes authoritative UTC timestamp using monotonic hardware counter (`Stopwatch.GetTimestamp()`)
    /// and flags whether the local OS system clock was rolled back or jumped forward (&gt; 30 seconds drift).
    /// </summary>
    public MonotonicClockAudit GetTamperProofTimestamp()
    {
        TimeSpan monotonicElapsed = Stopwatch.GetElapsedTime(_anchorStopwatchTimestamp);
        DateTimeOffset expectedUtc = _anchorWallClockUtc.Add(monotonicElapsed);
        DateTimeOffset currentOsWallClockUtc = DateTimeOffset.UtcNow;

        double driftSeconds = (currentOsWallClockUtc - expectedUtc).TotalSeconds;
        bool clockTampered = Math.Abs(driftSeconds) > 30.0;

        return new MonotonicClockAudit(
            AuthoritativeUtc: expectedUtc,
            OsWallClockUtc: currentOsWallClockUtc,
            DriftSeconds: Math.Round(driftSeconds, 2),
            IsClockTamperDetected: clockTampered);
    }

    public void EnqueueActivitySlice(ActivitySliceHarvest harvest, string trackerMode, string? activeTaskId)
    {
        MonotonicClockAudit clockAudit = GetTamperProofTimestamp();

        var item = new SpooledActivitySlice(
            SliceId: Guid.NewGuid().ToString("N"),
            AuthoritativeTimestampUtc: clockAudit.AuthoritativeUtc,
            OsWallClockUtc: clockAudit.OsWallClockUtc,
            ClockDriftSeconds: clockAudit.DriftSeconds,
            ClockTamperDetected: clockAudit.IsClockTamperDetected,
            TrackerMode: trackerMode,
            ActiveTaskId: activeTaskId,
            KeystrokeCount: harvest.KeystrokeCount,
            MouseClickCount: harvest.MouseClickCount,
            MouseScrollCount: harvest.MouseScrollCount,
            MouseDistancePixels: harvest.MouseDistancePixels,
            OsIdleSeconds: harvest.OsIdleSeconds,
            IsIdle: harvest.IsIdle,
            IsInActiveConferenceCall: harvest.IsInActiveConferenceCall,
            ProcessName: harvest.ForegroundWindow.ProcessName,
            WindowTitle: harvest.ForegroundWindow.WindowTitle,
            AnomalyCode: harvest.SuspiciousAnalysis.AnomalyCode);

        lock (_syncLock)
        {
            while (_activitySliceQueue.Count >= MaxActivitySliceCapacity)
            {
                _activitySliceQueue.RemoveFirst(); // FIFO ring-buffer auto-pruning
            }
            _activitySliceQueue.AddLast(item);

            if (clockAudit.IsClockTamperDetected)
            {
                EnqueueSecurityEventInternal(
                    "CLOCK_TAMPER_DRIFT",
                    "HIGH",
                    $"OS wall clock drifted by {clockAudit.DriftSeconds}s relative to monotonic hardware timer.");
            }

            if (harvest.SuspiciousAnalysis.IsSuspicious)
            {
                EnqueueSecurityEventInternal(
                    harvest.SuspiciousAnalysis.AnomalyCode,
                    "MEDIUM",
                    $"Mouse delta variance={harvest.SuspiciousAnalysis.SpatialDeltaVariance} with 0 keystrokes.");
            }

            FlushEncryptedWalToDiskNoLock();
        }
    }

    public void EnqueueMediaUpload(string mediaId, string mediaType, string sha256Hex, byte[] encryptedPayload, DateTimeOffset capturedAtUtc)
    {
        lock (_syncLock)
        {
            while (_mediaUploadQueue.Count >= MaxMediaQueueCapacity)
            {
                _mediaUploadQueue.RemoveFirst();
            }
            _mediaUploadQueue.AddLast(new SpooledMediaUploadItem(
                MediaId: mediaId,
                MediaType: mediaType,
                Sha256Hex: sha256Hex,
                PayloadBase64: Convert.ToBase64String(encryptedPayload),
                CapturedAtUtc: capturedAtUtc));

            FlushEncryptedWalToDiskNoLock();
        }
    }

    public void EnqueueSecurityEvent(string eventCode, string severity, string details)
    {
        lock (_syncLock)
        {
            EnqueueSecurityEventInternal(eventCode, severity, details);
            FlushEncryptedWalToDiskNoLock();
        }
    }

    private void EnqueueSecurityEventInternal(string eventCode, string severity, string details)
    {
        while (_securityEventQueue.Count >= MaxSecurityEventCapacity)
        {
            _securityEventQueue.RemoveFirst();
        }
        _securityEventQueue.AddLast(new SpooledSecurityEvent(
            EventId: Guid.NewGuid().ToString("N"),
            EventCode: eventCode,
            Severity: severity,
            Details: details,
            OccurredAtUtc: GetTamperProofTimestamp().AuthoritativeUtc));
    }

    public void SetConfigCache(string key, string jsonValue)
    {
        lock (_syncLock)
        {
            _localConfigCache[key] = jsonValue;
            FlushEncryptedWalToDiskNoLock();
        }
    }

    public string? GetConfigCache(string key)
    {
        lock (_syncLock)
        {
            return _localConfigCache.TryGetValue(key, out string? val) ? val : null;
        }
    }

    public IReadOnlyList<SpooledActivitySlice> PeekActivityBatch(int maxCount = 60)
    {
        lock (_syncLock)
        {
            return _activitySliceQueue.Take(maxCount).ToList();
        }
    }

    public void AcknowledgeUploadedSlices(IEnumerable<string> acknowledgedSliceIds)
    {
        var idSet = new HashSet<string>(acknowledgedSliceIds, StringComparer.Ordinal);
        lock (_syncLock)
        {
            var node = _activitySliceQueue.First;
            while (node != null)
            {
                var next = node.Next;
                if (idSet.Contains(node.Value.SliceId))
                {
                    _activitySliceQueue.Remove(node);
                }
                node = next;
            }
            FlushEncryptedWalToDiskNoLock();
        }
    }

    public SpoolQueueMetrics GetQueueMetrics()
    {
        lock (_syncLock)
        {
            return new SpoolQueueMetrics(
                PendingActivitySlices: _activitySliceQueue.Count,
                PendingMediaUploads: _mediaUploadQueue.Count,
                PendingSecurityEvents: _securityEventQueue.Count,
                CachedConfigKeys: _localConfigCache.Count);
        }
    }

    private void FlushEncryptedWalToDiskNoLock()
    {
        try
        {
            var state = new PersistedSpoolEnvelope(
                ActivitySlices: _activitySliceQueue.ToList(),
                MediaUploads: _mediaUploadQueue.ToList(),
                SecurityEvents: _securityEventQueue.ToList(),
                ConfigCache: new Dictionary<string, string>(_localConfigCache));

            byte[] plaintextUtf8 = JsonSerializer.SerializeToUtf8Bytes(state);
            byte[] encryptedBlob = EncryptAes256Gcm(plaintextUtf8, _aes256Key);

            string tempPath = _spoolFilePath + ".tmp";
            File.WriteAllBytes(tempPath, encryptedBlob);
            File.Move(tempPath, _spoolFilePath, overwrite: true);
        }
        catch
        {
            // Keep in-memory ring buffer alive even if disk is temporarily locked
        }
    }

    private void LoadEncryptedWalFromDisk()
    {
        if (!File.Exists(_spoolFilePath)) return;

        try
        {
            byte[] encryptedBlob = File.ReadAllBytes(_spoolFilePath);
            byte[] plaintextUtf8 = DecryptAes256Gcm(encryptedBlob, _aes256Key);
            var state = JsonSerializer.Deserialize<PersistedSpoolEnvelope>(plaintextUtf8);
            if (state == null) return;

            DateTimeOffset cutoff = DateTimeOffset.UtcNow.AddDays(-MaxOfflineRetentionDays);
            foreach (var slice in state.ActivitySlices.Where(s => s.AuthoritativeTimestampUtc >= cutoff))
            {
                _activitySliceQueue.AddLast(slice);
            }
            foreach (var media in state.MediaUploads.Where(m => m.CapturedAtUtc >= cutoff))
            {
                _mediaUploadQueue.AddLast(media);
            }
            foreach (var ev in state.SecurityEvents.Where(e => e.OccurredAtUtc >= cutoff))
            {
                _securityEventQueue.AddLast(ev);
            }
            foreach (var kvp in state.ConfigCache)
            {
                _localConfigCache[kvp.Key] = kvp.Value;
            }
        }
        catch
        {
            // Corrupted or key-rotated WAL; start fresh
        }
    }

    public static byte[] EncryptAes256Gcm(ReadOnlySpan<byte> plaintext, ReadOnlySpan<byte> key256)
    {
        // Format: [12-byte Nonce][16-byte Auth Tag][Ciphertext]
        byte[] output = new byte[12 + 16 + plaintext.Length];
        Span<byte> nonce = output.AsSpan(0, 12);
        Span<byte> tag = output.AsSpan(12, 16);
        Span<byte> ciphertext = output.AsSpan(28);

        RandomNumberGenerator.Fill(nonce);
        using var aesGcm = new AesGcm(key256, tagSizeInBytes: 16);
        aesGcm.Encrypt(nonce, plaintext, ciphertext, tag);
        return output;
    }

    public static byte[] DecryptAes256Gcm(ReadOnlySpan<byte> encryptedEnvelope, ReadOnlySpan<byte> key256)
    {
        if (encryptedEnvelope.Length < 28)
        {
            throw new CryptographicException("Invalid AES-256-GCM envelope length.");
        }

        ReadOnlySpan<byte> nonce = encryptedEnvelope[..12];
        ReadOnlySpan<byte> tag = encryptedEnvelope.Slice(12, 16);
        ReadOnlySpan<byte> ciphertext = encryptedEnvelope[28..];

        byte[] plaintext = new byte[ciphertext.Length];
        using var aesGcm = new AesGcm(key256, tagSizeInBytes: 16);
        aesGcm.Decrypt(nonce, ciphertext, tag, plaintext);
        return plaintext;
    }

    private static byte[] DeriveMachineBoundAes256Key(byte[]? customKey)
    {
        if (customKey is { Length: 32 })
        {
            return customKey;
        }

        string machineIdentity = $"HydiEms.Spool.v1|{Environment.MachineName}|{Environment.UserName}";
        return SHA256.HashData(Encoding.UTF8.GetBytes(machineIdentity));
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        lock (_syncLock)
        {
            FlushEncryptedWalToDiskNoLock();
        }
        CryptographicOperations.ZeroMemory(_aes256Key);
    }

    private sealed record PersistedSpoolEnvelope(
        List<SpooledActivitySlice> ActivitySlices,
        List<SpooledMediaUploadItem> MediaUploads,
        List<SpooledSecurityEvent> SecurityEvents,
        Dictionary<string, string> ConfigCache);
}

public sealed record MonotonicClockAudit(
    DateTimeOffset AuthoritativeUtc,
    DateTimeOffset OsWallClockUtc,
    double DriftSeconds,
    bool IsClockTamperDetected);

public sealed record SpooledActivitySlice(
    string SliceId,
    DateTimeOffset AuthoritativeTimestampUtc,
    DateTimeOffset OsWallClockUtc,
    double ClockDriftSeconds,
    bool ClockTamperDetected,
    string TrackerMode,
    string? ActiveTaskId,
    int KeystrokeCount,
    int MouseClickCount,
    int MouseScrollCount,
    int MouseDistancePixels,
    uint OsIdleSeconds,
    bool IsIdle,
    bool IsInActiveConferenceCall,
    string ProcessName,
    string WindowTitle,
    string AnomalyCode);

public sealed record SpooledMediaUploadItem(
    string MediaId,
    string MediaType,
    string Sha256Hex,
    string PayloadBase64,
    DateTimeOffset CapturedAtUtc);

public sealed record SpooledSecurityEvent(
    string EventId,
    string EventCode,
    string Severity,
    string Details,
    DateTimeOffset OccurredAtUtc);

public sealed record SpoolQueueMetrics(
    int PendingActivitySlices,
    int PendingMediaUploads,
    int PendingSecurityEvents,
    int CachedConfigKeys);
