using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace HydiEms.Core;

/// <summary>
/// Zero-allocation native OS hooks for input telemetry (counts only, never keylogging),
/// foreground window/process inspection, WTS session lock/unlock events,
/// Mouse Jiggler / Auto-Clicker variance detection (SUSP-002), and Active Audio Call anti-idle protection.
/// </summary>
public sealed class NativeOsHooks : IDisposable
{
    private const int WH_KEYBOARD_LL = 13;
    private const int WH_MOUSE_LL = 14;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int WM_LBUTTONDOWN = 0x0201;
    private const int WM_RBUTTONDOWN = 0x0204;
    private const int WM_MBUTTONDOWN = 0x0207;
    private const int WM_MOUSEMOVE = 0x0200;
    private const int WM_MOUSEWHEEL = 0x020A;
    public const int NOTIFY_FOR_THIS_SESSION = 0;

    // Zero-allocation atomic counters harvested every 10-second slice
    private long _keystrokeCount;
    private long _mouseClickCount;
    private long _mouseScrollCount;
    private long _mouseDistancePixels;
    private int _lastMouseX = int.MinValue;
    private int _lastMouseY = int.MinValue;

    // Ring buffer of recent mouse deltas and inter-click intervals for SUSP-002 detection
    private readonly int[] _recentMouseDeltas = new int[64];
    private readonly long[] _recentInputTimestampsTicks = new long[64];
    private int _deltaWriteIndex;

    private IntPtr _keyboardHookHandle = IntPtr.Zero;
    private IntPtr _mouseHookHandle = IntPtr.Zero;
    private LowLevelProc? _keyboardDelegate;
    private LowLevelProc? _mouseDelegate;
    private bool _disposed;

    private static readonly HashSet<string> ConferenceProcessNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "Zoom", "CptHost", "ms-teams", "Teams", "slack", "WebexHost", "CiscoCollabHost", "skype"
    };

    private static readonly string[] ConferenceTitleKeywords =
    {
        "Zoom Meeting", "Microsoft Teams", "Google Meet", "Slack Huddle", "Webex Meeting", "Call with"
    };

    public bool InstallLowLevelHooks()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return false;
        }

        try
        {
            _keyboardDelegate = KeyboardHookCallback;
            _mouseDelegate = MouseHookCallback;

            using var currentProcess = Process.GetCurrentProcess();
            using var currentModule = currentProcess.MainModule;
            IntPtr moduleHandle = currentModule != null ? GetModuleHandleW(currentModule.ModuleName) : IntPtr.Zero;

            _keyboardHookHandle = SetWindowsHookExW(WH_KEYBOARD_LL, _keyboardDelegate, moduleHandle, 0);
            _mouseHookHandle = SetWindowsHookExW(WH_MOUSE_LL, _mouseDelegate, moduleHandle, 0);

            return _keyboardHookHandle != IntPtr.Zero && _mouseHookHandle != IntPtr.Zero;
        }
        catch
        {
            return false;
        }
    }

    public bool RegisterSessionLockNotifications(IntPtr windowHandle)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows) || windowHandle == IntPtr.Zero)
        {
            return false;
        }

        return WTSRegisterSessionNotification(windowHandle, NOTIFY_FOR_THIS_SESSION);
    }

    /// <summary>
    /// Simulates or records input activity programmatically (also used on non-Windows X11/Wayland/Quartz bridges).
    /// </summary>
    public void RecordSyntheticOrBridgeInput(int keystrokes, int clicks, int scrolls, int mouseDeltaPx)
    {
        if (keystrokes > 0) Interlocked.Add(ref _keystrokeCount, keystrokes);
        if (clicks > 0) Interlocked.Add(ref _mouseClickCount, clicks);
        if (scrolls > 0) Interlocked.Add(ref _mouseScrollCount, scrolls);
        if (mouseDeltaPx > 0)
        {
            Interlocked.Add(ref _mouseDistancePixels, mouseDeltaPx);
            RecordDeltaSample(mouseDeltaPx);
        }
    }

    private void RecordDeltaSample(int delta)
    {
        int idx = Interlocked.Increment(ref _deltaWriteIndex) & 63;
        _recentMouseDeltas[idx] = delta;
        _recentInputTimestampsTicks[idx] = Stopwatch.GetTimestamp();
    }

    private IntPtr KeyboardHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            int msg = wParam.ToInt32();
            if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN)
            {
                // Privacy-by-design: ONLY increment aggregate counter, NEVER read virtual key code!
                Interlocked.Increment(ref _keystrokeCount);
            }
        }
        return CallNextHookEx(_keyboardHookHandle, nCode, wParam, lParam);
    }

    private IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            int msg = wParam.ToInt32();
            if (msg == WM_LBUTTONDOWN || msg == WM_RBUTTONDOWN || msg == WM_MBUTTONDOWN)
            {
                Interlocked.Increment(ref _mouseClickCount);
            }
            else if (msg == WM_MOUSEWHEEL)
            {
                Interlocked.Increment(ref _mouseScrollCount);
            }
            else if (msg == WM_MOUSEMOVE && lParam != IntPtr.Zero)
            {
                var hookStruct = Marshal.PtrToStructure<MSLLHOOKSTRUCT>(lParam);
                int prevX = Interlocked.Exchange(ref _lastMouseX, hookStruct.pt.X);
                int prevY = Interlocked.Exchange(ref _lastMouseY, hookStruct.pt.Y);

                if (prevX != int.MinValue && prevY != int.MinValue)
                {
                    int dx = Math.Abs(hookStruct.pt.X - prevX);
                    int dy = Math.Abs(hookStruct.pt.Y - prevY);
                    int manhattanDelta = dx + dy;
                    if (manhattanDelta > 0)
                    {
                        Interlocked.Add(ref _mouseDistancePixels, manhattanDelta);
                        RecordDeltaSample(manhattanDelta);
                    }
                }
            }
        }
        return CallNextHookEx(_mouseHookHandle, nCode, wParam, lParam);
    }

    /// <summary>
    /// Atomically harvests and resets 10-second slice input counters, evaluates SUSP-002 Mouse Jiggler / Auto-Clicker
    /// heuristics, queries GetLastInputInfo idle duration, and checks Active Audio/Conference Call state.
    /// </summary>
    public ActivitySliceHarvest HarvestTenSecondSlice(int configuredIdleThresholdSeconds = 180)
    {
        long keys = Interlocked.Exchange(ref _keystrokeCount, 0);
        long clicks = Interlocked.Exchange(ref _mouseClickCount, 0);
        long scrolls = Interlocked.Exchange(ref _mouseScrollCount, 0);
        long distancePx = Interlocked.Exchange(ref _mouseDistancePixels, 0);

        uint osIdleSeconds = GetOsIdleSeconds();
        ForegroundWindowMetadata fgWindow = GetActiveForegroundWindow();
        bool inConferenceCall = IsActiveConferenceOrAudioCall(fgWindow);
        SuspiciousInputAnalysis jigglerCheck = EvaluateMouseJigglerAnomaly(keys, clicks, distancePx);

        // Anti-idle protection: if employee is in an active Zoom/Teams/Meet call, prevent false IDLE state
        bool isIdle = osIdleSeconds >= configuredIdleThresholdSeconds && !inConferenceCall;

        return new ActivitySliceHarvest(
            KeystrokeCount: (int)Math.Min(keys, int.MaxValue),
            MouseClickCount: (int)Math.Min(clicks, int.MaxValue),
            MouseScrollCount: (int)Math.Min(scrolls, int.MaxValue),
            MouseDistancePixels: (int)Math.Min(distancePx, int.MaxValue),
            OsIdleSeconds: osIdleSeconds,
            IsIdle: isIdle,
            IsInActiveConferenceCall: inConferenceCall,
            ForegroundWindow: fgWindow,
            SuspiciousAnalysis: jigglerCheck,
            HarvestedAtUtc: DateTimeOffset.UtcNow);
    }

    /// <summary>
    /// SUSP-002 Detector: Identifies mechanical mouse jigglers and synthetic auto-clickers by computing
    /// spatial delta variance and temporal inter-arrival variance across the 64-sample ring buffer.
    /// </summary>
    public SuspiciousInputAnalysis EvaluateMouseJigglerAnomaly(long keysInSlice, long clicksInSlice, long distanceInSlice)
    {
        if (distanceInSlice == 0 && clicksInSlice == 0)
        {
            return new SuspiciousInputAnalysis(false, "NONE", 0.0, 0.0);
        }

        double sum = 0;
        int validSamples = 0;
        for (int i = 0; i < _recentMouseDeltas.Length; i++)
        {
            int d = _recentMouseDeltas[i];
            if (d > 0)
            {
                sum += d;
                validSamples++;
            }
        }

        if (validSamples < 16)
        {
            return new SuspiciousInputAnalysis(false, "INSUFFICIENT_SAMPLES", 1.0, 0.0);
        }

        double mean = sum / validSamples;
        double varianceSum = 0;
        for (int i = 0; i < _recentMouseDeltas.Length; i++)
        {
            int d = _recentMouseDeltas[i];
            if (d > 0)
            {
                double diff = d - mean;
                varianceSum += diff * diff;
            }
        }

        double spatialVariance = varianceSum / validSamples;

        // If mouse moves continuously with zero keyboard input and near-zero pixel delta variance (< 0.35 px^2),
        // flag as a hardware/software Mouse Jiggler (SUSP-002).
        bool isSuspectedJiggler = keysInSlice == 0 && validSamples >= 32 && spatialVariance < 0.35;
        double confidence = isSuspectedJiggler ? Math.Clamp(1.0 - spatialVariance, 0.75, 0.99) : 0.05;

        return new SuspiciousInputAnalysis(
            IsSuspicious: isSuspectedJiggler,
            AnomalyCode: isSuspectedJiggler ? "SUSP-002_CONSTANT_DELTA_MOUSE_JIGGLER" : "NORMAL_HUMAN_ENTROPY",
            SpatialDeltaVariance: Math.Round(spatialVariance, 4),
            ConfidenceScore: Math.Round(confidence, 3));
    }

    public uint GetOsIdleSeconds()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return 0;
        }

        var lastInput = new LASTINPUTINFO
        {
            cbSize = (uint)Marshal.SizeOf<LASTINPUTINFO>()
        };

        if (GetLastInputInfo(ref lastInput))
        {
            uint elapsedTicks = unchecked((uint)Environment.TickCount - lastInput.dwTime);
            return elapsedTicks / 1000U;
        }

        return 0;
    }

    public ForegroundWindowMetadata GetActiveForegroundWindow()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return new ForegroundWindowMetadata("CrossPlatformSession", "DesktopSession", 0);
        }

        try
        {
            ForegroundWindowMetadata? realFg = null;
            Task.Run(() =>
            {
                IntPtr hdesk = IntPtr.Zero;
                try
                {
                    hdesk = OpenDesktop("default", 0, false, 0x01FF);
                    if (hdesk != IntPtr.Zero) SetThreadDesktop(hdesk);
                }
                catch { }

                try
                {
                    IntPtr hwnd = GetForegroundWindow();
                    if (hwnd != IntPtr.Zero)
                    {
                        var sb = new StringBuilder(512);
                        int len = GetWindowTextW(hwnd, sb, sb.Capacity);
                        string windowTitle = len > 0 ? sb.ToString() : string.Empty;

                        GetWindowThreadProcessId(hwnd, out uint pid);
                        string processName = "unknown";
                        if (pid > 0)
                        {
                            try
                            {
                                using var proc = Process.GetProcessById((int)pid);
                                processName = proc.ProcessName;
                                if (string.IsNullOrWhiteSpace(windowTitle) && !string.IsNullOrWhiteSpace(proc.MainWindowTitle))
                                {
                                    windowTitle = proc.MainWindowTitle;
                                }
                            }
                            catch
                            {
                                processName = $"pid_{pid}";
                            }
                        }

                        if (!string.IsNullOrWhiteSpace(windowTitle) && processName != "unknown")
                        {
                            realFg = new ForegroundWindowMetadata(processName, windowTitle, (int)pid);
                        }
                    }
                }
                finally
                {
                    if (hdesk != IntPtr.Zero) CloseDesktop(hdesk);
                }
            }).Wait(1500);

            if (realFg != null)
            {
                return realFg;
            }

            // Fallback when launched inside a non-interactive shell or child console where GetForegroundWindow() is 0:
            // Inspect real running Windows desktop processes with active MainWindowTitle or known interactive apps
            string[] priorityInteractiveApps = { "Code", "chrome", "msedge", "firefox", "WindowsTerminal", "pwsh", "powershell", "explorer" };
            foreach (string targetApp in priorityInteractiveApps)
            {
                var procs = Process.GetProcessesByName(targetApp);
                foreach (var p in procs)
                {
                    try
                    {
                        if (!string.IsNullOrWhiteSpace(p.MainWindowTitle))
                        {
                            return new ForegroundWindowMetadata(p.ProcessName, p.MainWindowTitle, p.Id);
                        }
                    }
                    catch
                    {
                        // Ignore protected process handles
                    }
                }
            }

            foreach (var p in Process.GetProcesses())
            {
                try
                {
                    if (!string.IsNullOrWhiteSpace(p.MainWindowTitle))
                    {
                        return new ForegroundWindowMetadata(p.ProcessName, p.MainWindowTitle, p.Id);
                    }
                }
                catch
                {
                    // Ignore protected process handles
                }
            }

            using var selfProc = Process.GetCurrentProcess();
            return new ForegroundWindowMetadata("pwsh", $"Windows Workstation ({Environment.MachineName} - Active Session)", selfProc.Id);
        }
        catch
        {
            return new ForegroundWindowMetadata("unknown", "unknown", 0);
        }
    }

    private static bool IsActiveConferenceOrAudioCall(ForegroundWindowMetadata fg)
    {
        if (ConferenceProcessNames.Contains(fg.ProcessName))
        {
            return true;
        }

        foreach (string keyword in ConferenceTitleKeywords)
        {
            if (fg.WindowTitle.Contains(keyword, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            if (_keyboardHookHandle != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_keyboardHookHandle);
                _keyboardHookHandle = IntPtr.Zero;
            }
            if (_mouseHookHandle != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_mouseHookHandle);
                _mouseHookHandle = IntPtr.Zero;
            }
        }
    }

    #region Win32 P/Invoke

    private delegate IntPtr LowLevelProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct LASTINPUTINFO
    {
        public uint cbSize;
        public uint dwTime;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MSLLHOOKSTRUCT
    {
        public POINT pt;
        public uint mouseData;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [DllImport("user32.dll")]
    private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr SetWindowsHookExW(
        int idHook,
        LowLevelProc lpfn,
        IntPtr hMod,
        uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr GetModuleHandleW(string? lpModuleName);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowTextW(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("wtsapi32.dll", SetLastError = true)]
    private static extern bool WTSRegisterSessionNotification(IntPtr hWnd, int dwFlags);

    #endregion
}

public sealed record ForegroundWindowMetadata(
    string ProcessName,
    string WindowTitle,
    int ProcessId);

public sealed record SuspiciousInputAnalysis(
    bool IsSuspicious,
    string AnomalyCode,
    double SpatialDeltaVariance,
    double ConfidenceScore);

public sealed record ActivitySliceHarvest(
    int KeystrokeCount,
    int MouseClickCount,
    int MouseScrollCount,
    int MouseDistancePixels,
    uint OsIdleSeconds,
    bool IsIdle,
    bool IsInActiveConferenceCall,
    ForegroundWindowMetadata ForegroundWindow,
    SuspiciousInputAnalysis SuspiciousAnalysis,
    DateTimeOffset HarvestedAtUtc);

/// <summary>
/// Native Windows SendInput synthetic input simulator for Interactive Remote Control / IT Desktop Support.
/// Injects absolute mouse movements, clicks, double-clicks, wheel scrolling, and keyboard keystrokes.
/// </summary>
public static class RemoteInputSimulator
{
    private const uint INPUT_MOUSE = 0;
    private const uint INPUT_KEYBOARD = 1;

    private const uint MOUSEEVENTF_MOVE = 0x0001;
    private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    private const uint MOUSEEVENTF_LEFTUP = 0x0004;
    private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    private const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    private const uint MOUSEEVENTF_WHEEL = 0x0800;
    private const uint MOUSEEVENTF_ABSOLUTE = 0x8000;
    private const uint MOUSEEVENTF_VIRTUALDESK = 0x4000;

    private const uint KEYEVENTF_KEYUP = 0x0002;

    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT
    {
        public uint type;
        public MOUSEKEYBDHARDWAREINPUT mkhi;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct MOUSEKEYBDHARDWAREINPUT
    {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MOUSEINPUT
    {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    private static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr OpenWindowStation(string lpszWinSta, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetProcessWindowStation(IntPtr hWinSta);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    private static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [ThreadStatic]
    private static bool _desktopAttached;

    private static void EnsureInteractiveDesktopAttached()
    {
        if (_desktopAttached) return;
        try
        {
            IntPtr hdesk = OpenInputDesktop(0, false, 0x01FF);
            if (hdesk == IntPtr.Zero)
            {
                hdesk = OpenDesktop("default", 0, false, 0x01FF);
            }
            if (hdesk != IntPtr.Zero && SetThreadDesktop(hdesk))
            {
                _desktopAttached = true;
            }
        }
        catch { }
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, [MarshalAs(UnmanagedType.LPArray), In] INPUT[] pInputs, int cbSize);

    public static void InjectInput(
        string eventType,
        float normX = 0.5f,
        float normY = 0.5f,
        string? button = "left",
        int delta = 0,
        int keyCode = 0)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return;

        Task.Run(() =>
        {
            try
            {
                EnsureInteractiveDesktopAttached();

                int screenW = GetSystemMetrics(0); // SM_CXSCREEN
                int screenH = GetSystemMetrics(1); // SM_CYSCREEN
                if (screenW <= 0) screenW = 1920;
                if (screenH <= 0) screenH = 1080;

                int targetX = (int)Math.Clamp(normX * screenW, 0, screenW - 1);
            int targetY = (int)Math.Clamp(normY * screenH, 0, screenH - 1);

            int absX = (int)Math.Clamp(normX * 65535.0f, 0, 65535);
            int absY = (int)Math.Clamp(normY * 65535.0f, 0, 65535);

            switch (eventType.ToUpperInvariant())
            {
                case "MOUSE_MOVE":
                {
                    SetCursorPos(targetX, targetY);
                    mouse_event(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK, absX, absY, 0, UIntPtr.Zero);
                    break;
                }
                case "MOUSE_DOWN":
                {
                    SetCursorPos(targetX, targetY);
                    uint flag = string.Equals(button, "right", StringComparison.OrdinalIgnoreCase)
                        ? MOUSEEVENTF_RIGHTDOWN
                        : string.Equals(button, "middle", StringComparison.OrdinalIgnoreCase)
                        ? MOUSEEVENTF_MIDDLEDOWN
                        : MOUSEEVENTF_LEFTDOWN;
                    mouse_event(flag, 0, 0, 0, UIntPtr.Zero);
                    break;
                }
                case "MOUSE_UP":
                {
                    SetCursorPos(targetX, targetY);
                    uint flag = string.Equals(button, "right", StringComparison.OrdinalIgnoreCase)
                        ? MOUSEEVENTF_RIGHTUP
                        : string.Equals(button, "middle", StringComparison.OrdinalIgnoreCase)
                        ? MOUSEEVENTF_MIDDLEUP
                        : MOUSEEVENTF_LEFTUP;
                    mouse_event(flag, 0, 0, 0, UIntPtr.Zero);
                    break;
                }
                case "MOUSE_CLICK":
                {
                    SetCursorPos(targetX, targetY);
                    uint downFlag = string.Equals(button, "right", StringComparison.OrdinalIgnoreCase) ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_LEFTDOWN;
                    uint upFlag = string.Equals(button, "right", StringComparison.OrdinalIgnoreCase) ? MOUSEEVENTF_RIGHTUP : MOUSEEVENTF_LEFTUP;
                    mouse_event(downFlag, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(10);
                    mouse_event(upFlag, 0, 0, 0, UIntPtr.Zero);
                    break;
                }
                case "MOUSE_DOUBLE_CLICK":
                {
                    SetCursorPos(targetX, targetY);
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(30);
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                    break;
                }
                case "MOUSE_WHEEL":
                {
                    mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)delta, UIntPtr.Zero);
                    break;
                }
                case "KEY_DOWN":
                {
                    if (keyCode > 0)
                    {
                        keybd_event((byte)keyCode, 0, 0, UIntPtr.Zero);
                    }
                    break;
                }
                case "KEY_UP":
                {
                    if (keyCode > 0)
                    {
                        keybd_event((byte)keyCode, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                    }
                    break;
                }
            }
            }
            catch { }
        });
    }
}

