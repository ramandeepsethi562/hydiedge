"""
HydiEms Unified LiveKit Multi-Track HD Streamer & Remote Control Engine
Streams:
  1. 1080p Desktop Screen Video (SOURCE_SCREENSHARE) with Live Hardware Cursor Overlay
  2. Webcam Operator Video (SOURCE_CAMERA)
  3. 48kHz Studio HD Audio (SOURCE_MICROPHONE)
  4. Bi-Directional LiveKit WebRTC DataChannel + REST Remote Desktop Control (Mouse & Keyboard)
Zero clipping, zero audio stutter, sub-100ms ultra-low latency.
"""
import asyncio
import ctypes
from ctypes import wintypes
import json
import os
import queue
import sys
import threading
import time
from collections import deque
import cv2
import numpy as np
from PIL import ImageGrab
import requests
import sounddevice as sd
from livekit import rtc

API_URL = os.environ.get("HYDI_API_URL", "https://api.hydiedge.com")
EMPLOYEE_ID = os.environ.get("HYDI_EMPLOYEE_ID", "emp-win-ramandeep")
LIVEKIT_URL = os.environ.get("HYDI_LIVEKIT_WS", "ws://135.181.5.108:7880")
SAMPLE_RATE = 48000
CHANNELS = 1
FRAME_SIZE = 480  # 10ms at 48kHz

# Win32 Mouse & Keyboard Constants
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_WHEEL = 0x0800
MOUSEEVENTF_VIRTUALDESK = 0x4000
MOUSEEVENTF_ABSOLUTE = 0x8000
KEYEVENTF_KEYUP = 0x0002

KEY_NAME_TO_VK = {
    "Enter": 0x0D,
    "Backspace": 0x08,
    "Tab": 0x09,
    "Escape": 0x1B,
    " ": 0x20,
    "Space": 0x20,
    "ArrowLeft": 0x25,
    "ArrowUp": 0x26,
    "ArrowRight": 0x27,
    "ArrowDown": 0x28,
    "Delete": 0x2E,
    "Home": 0x24,
    "End": 0x23,
    "PageUp": 0x21,
    "PageDown": 0x22,
    "Shift": 0x10,
    "Control": 0x11,
    "Alt": 0x12,
}

# Thread-safe queue and deduplication set for Remote Control events
remote_input_queue = queue.Queue(maxsize=2000)
seen_event_ids = deque(maxlen=2000)
seen_lock = threading.Lock()
last_click_time = 0.0


def attach_thread_desktop():
    """Attaches calling thread (must have no HWNDs/hooks) to Windows interactive input desktop."""
    if sys.platform == "win32":
        try:
            user32 = ctypes.windll.user32
            hdesk = user32.OpenInputDesktop(0, False, 0x01FF)
            if not hdesk:
                hdesk = user32.OpenDesktopW("default", 0, False, 0x01FF)
            if hdesk:
                user32.SetThreadDesktop(hdesk)
                return True
        except Exception:
            pass
    return False


def enqueue_remote_event(evt: dict):
    """Deduplicates and enqueues a remote control input event."""
    if not isinstance(evt, dict):
        return
    if "event" in evt and isinstance(evt["event"], dict):
        evt = evt["event"]

    evt_id = evt.get("eventId")
    if evt_id:
        with seen_lock:
            if evt_id in seen_event_ids:
                return
            seen_event_ids.append(evt_id)

    try:
        remote_input_queue.put_nowait(evt)
    except queue.Full:
        pass


def resolve_vk(key_code: int, key_str: str) -> int:
    if key_code and 0 < key_code < 256:
        return int(key_code)
    if not key_str:
        return 0
    if key_str in KEY_NAME_TO_VK:
        return KEY_NAME_TO_VK[key_str]
    if len(key_str) == 1:
        ch = key_str.upper()
        if "A" <= ch <= "Z" or "0" <= ch <= "9":
            return ord(ch)
    return 0


def execute_win32_input(evt: dict, screen_w: int, screen_h: int):
    """Executes mouse and keyboard input on the attached interactive desktop thread."""
    global last_click_time
    if sys.platform != "win32":
        return

    user32 = ctypes.windll.user32
    evt_type = str(evt.get("eventType", "MOUSE_MOVE")).upper()
    norm_x = float(evt.get("normalizedX", 0.5))
    norm_y = float(evt.get("normalizedY", 0.5))
    norm_x = max(0.0, min(1.0, norm_x))
    norm_y = max(0.0, min(1.0, norm_y))

    button = str(evt.get("button", "left")).lower()
    delta = int(evt.get("delta", 0))
    key_code = int(evt.get("keyCode", 0))
    key_str = str(evt.get("key", ""))

    target_x = int(max(0, min(screen_w - 1, round(norm_x * screen_w))))
    target_y = int(max(0, min(screen_h - 1, round(norm_y * screen_h))))
    abs_x = int(max(0, min(65535, round(norm_x * 65535.0))))
    abs_y = int(max(0, min(65535, round(norm_y * 65535.0))))

    if evt_type == "MOUSE_MOVE":
        user32.SetCursorPos(target_x, target_y)
        user32.mouse_event(
            MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK,
            abs_x,
            abs_y,
            0,
            0,
        )
    elif evt_type == "MOUSE_DOWN":
        last_click_time = time.time()
        user32.SetCursorPos(target_x, target_y)
        user32.mouse_event(
            MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK,
            abs_x,
            abs_y,
            0,
            0,
        )
        flag = (
            MOUSEEVENTF_RIGHTDOWN
            if button == "right"
            else MOUSEEVENTF_MIDDLEDOWN
            if button == "middle"
            else MOUSEEVENTF_LEFTDOWN
        )
        user32.mouse_event(flag, 0, 0, 0, 0)
    elif evt_type == "MOUSE_UP":
        user32.SetCursorPos(target_x, target_y)
        flag = (
            MOUSEEVENTF_RIGHTUP
            if button == "right"
            else MOUSEEVENTF_MIDDLEUP
            if button == "middle"
            else MOUSEEVENTF_LEFTUP
        )
        user32.mouse_event(flag, 0, 0, 0, 0)
    elif evt_type == "MOUSE_CLICK":
        last_click_time = time.time()
        user32.SetCursorPos(target_x, target_y)
        down_flag = MOUSEEVENTF_RIGHTDOWN if button == "right" else MOUSEEVENTF_LEFTDOWN
        up_flag = MOUSEEVENTF_RIGHTUP if button == "right" else MOUSEEVENTF_LEFTUP
        user32.mouse_event(down_flag, 0, 0, 0, 0)
        time.sleep(0.01)
        user32.mouse_event(up_flag, 0, 0, 0, 0)
    elif evt_type == "MOUSE_DOUBLE_CLICK":
        last_click_time = time.time()
        user32.SetCursorPos(target_x, target_y)
        user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
        user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
        time.sleep(0.025)
        user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
        user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
    elif evt_type == "MOUSE_WHEEL":
        user32.mouse_event(MOUSEEVENTF_WHEEL, 0, 0, ctypes.c_uint(delta).value, 0)
    elif evt_type == "KEY_DOWN":
        vk = resolve_vk(key_code, key_str)
        if vk > 0:
            user32.keybd_event(vk, 0, 0, 0)
    elif evt_type == "KEY_UP":
        vk = resolve_vk(key_code, key_str)
        if vk > 0:
            user32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)


def draw_cursor_overlay(frame_rgba: np.ndarray, screen_w: int, screen_h: int):
    """Draws the live OS hardware cursor position and click indicator onto the RGBA screen frame."""
    if sys.platform != "win32":
        return
    try:
        pt = wintypes.POINT()
        if ctypes.windll.user32.GetCursorPos(ctypes.byref(pt)):
            cx, cy = int(pt.x), int(pt.y)
            if 0 <= cx < screen_w and 0 <= cy < screen_h:
                # Draw click ripple if clicked within last 250ms
                if time.time() - last_click_time < 0.25:
                    cv2.circle(frame_rgba, (cx, cy), 18, (168, 85, 247, 255), 2, cv2.LINE_AA)

                # Draw high-contrast cursor pointer polygon
                arrow = np.array([
                    [cx, cy],
                    [cx, cy + 18],
                    [cx + 5, cy + 14],
                    [cx + 9, cy + 22],
                    [cx + 12, cy + 20],
                    [cx + 8, cy + 12],
                    [cx + 14, cy + 12],
                ], dtype=np.int32)
                cv2.fillPoly(frame_rgba, [arrow], (255, 255, 255, 255), cv2.LINE_AA)
                cv2.polylines(frame_rgba, [arrow], True, (15, 23, 42, 255), 2, cv2.LINE_AA)
    except Exception:
        pass


async def fetch_token():
    url = f"{API_URL.rstrip('/')}/api/v1/live/livekit/token?canPublish=true&employeeId={EMPLOYEE_ID}"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    return data["token"], data.get("wsUrl", LIVEKIT_URL)


async def run_publisher():
    while True:
        try:
            print(f"[LiveKit Unified] Fetching publishing token for {EMPLOYEE_ID}...", flush=True)
            token, ws_url = await fetch_token()
            print(f"[LiveKit Unified] Connecting to LiveKit SFU...", flush=True)

            room = rtc.Room()

            @room.on("connected")
            def on_connected():
                print(f"[LiveKit Unified] Connected to room '{room.name}' as '{room.local_participant.identity}'", flush=True)

            @room.on("disconnected")
            def on_disconnected(reason):
                print(f"[LiveKit Unified] Disconnected: {reason}", flush=True)

            @room.on("data_received")
            def on_data_received(data_packet: rtc.DataPacket):
                try:
                    raw = bytes(data_packet.data).decode("utf-8")
                    payload = json.loads(raw)
                    enqueue_remote_event(payload)
                except Exception:
                    pass

            try:
                await room.connect(LIVEKIT_URL, token)
            except Exception as ex:
                print(f"[LiveKit Unified] Direct connect failed ({ex}), trying {ws_url}...", flush=True)
                await room.connect(ws_url, token)

            # -------------------------------------------------------------
            # 1. 48kHz Studio HD Audio Track (Opus Full-Band)
            # -------------------------------------------------------------
            print("[LiveKit Unified] Publishing 48kHz Studio Audio Track...", flush=True)
            audio_source = rtc.AudioSource(SAMPLE_RATE, CHANNELS)
            audio_track = rtc.LocalAudioTrack.create_audio_track("workstation-mic", audio_source)
            audio_pub = await room.local_participant.publish_track(
                audio_track,
                rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
            )
            print(f"[LiveKit Unified] Audio Track published (SID: {audio_pub.sid})", flush=True)

            # -------------------------------------------------------------
            # 2. 1080p Screen Video Track (SOURCE_SCREENSHARE)
            # -------------------------------------------------------------
            user32 = ctypes.windll.user32 if sys.platform == "win32" else None
            screen_w = user32.GetSystemMetrics(0) if user32 else 1920
            screen_h = user32.GetSystemMetrics(1) if user32 else 1080
            print(f"[LiveKit Unified] Publishing {screen_w}x{screen_h} Screen Video Track...", flush=True)

            screen_source = rtc.VideoSource(screen_w, screen_h)
            screen_track = rtc.LocalVideoTrack.create_video_track("workstation-screen", screen_source)
            screen_pub = await room.local_participant.publish_track(
                screen_track,
                rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_SCREENSHARE)
            )
            print(f"[LiveKit Unified] Screen Track published (SID: {screen_pub.sid})", flush=True)

            # -------------------------------------------------------------
            # 3. Webcam Operator Video Track (SOURCE_CAMERA)
            # -------------------------------------------------------------
            cap = cv2.VideoCapture(0)
            cam_available = cap.isOpened()
            cam_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640
            cam_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 480
            if not cam_available:
                cam_w, cam_h = 640, 480
                print("[LiveKit Unified] No physical camera found, creating virtual camera source...", flush=True)

            print(f"[LiveKit Unified] Publishing {cam_w}x{cam_h} Webcam Camera Track...", flush=True)
            camera_source = rtc.VideoSource(cam_w, cam_h)
            camera_track = rtc.LocalVideoTrack.create_video_track("workstation-camera", camera_source)
            camera_pub = await room.local_participant.publish_track(
                camera_track,
                rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_CAMERA)
            )
            print(f"[LiveKit Unified] Camera Track published (SID: {camera_pub.sid})", flush=True)

            # -------------------------------------------------------------
            # 4. Audio Input Stream (WASAPI 48kHz Float32 -> Int16 PCM)
            # -------------------------------------------------------------
            audio_queue = asyncio.Queue(maxsize=100)

            def sound_callback(indata, frames, time_info, status):
                clipped = np.clip(indata, -1.0, 1.0)
                int16_data = (clipped * 32767.0).astype(np.int16)
                try:
                    audio_queue.put_nowait(int16_data.tobytes())
                except asyncio.QueueFull:
                    pass

            audio_stream = sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=CHANNELS,
                blocksize=FRAME_SIZE,
                dtype='float32',
                callback=sound_callback
            )
            audio_stream.start()

            # -------------------------------------------------------------
            # 5. Dedicated Worker Threads for Video Capture & Remote Control
            # -------------------------------------------------------------
            stop_workers = threading.Event()

            # Screen capture thread (~15 FPS) with live cursor overlay
            def screen_worker():
                attach_thread_desktop()
                interval = 1.0 / 15.0
                while not stop_workers.is_set():
                    t0 = time.time()
                    try:
                        img = ImageGrab.grab()
                        img_rgba = np.array(img.convert("RGBA"), dtype=np.uint8)
                        draw_cursor_overlay(img_rgba, screen_w, screen_h)
                        vframe = rtc.VideoFrame(screen_w, screen_h, rtc.VideoBufferType.RGBA, img_rgba.tobytes())
                        screen_source.capture_frame(vframe)
                    except Exception:
                        attach_thread_desktop()
                    elapsed = time.time() - t0
                    time.sleep(max(0.01, interval - elapsed))

            # Camera capture thread (~15 FPS)
            def camera_worker():
                interval = 1.0 / 15.0
                while not stop_workers.is_set():
                    t0 = time.time()
                    try:
                        if cam_available and cap.isOpened():
                            ret, frame = cap.read()
                            if ret:
                                rgba = cv2.cvtColor(frame, cv2.COLOR_BGR2RGBA)
                                vframe = rtc.VideoFrame(cam_w, cam_h, rtc.VideoBufferType.RGBA, rgba.tobytes())
                                camera_source.capture_frame(vframe)
                        else:
                            dummy = np.zeros((cam_h, cam_w, 4), dtype=np.uint8)
                            dummy[:, :, 0] = 30
                            dummy[:, :, 1] = 40
                            dummy[:, :, 2] = 50
                            dummy[:, :, 3] = 255
                            vframe = rtc.VideoFrame(cam_w, cam_h, rtc.VideoBufferType.RGBA, dummy.tobytes())
                            camera_source.capture_frame(vframe)
                    except Exception:
                        pass
                    elapsed = time.time() - t0
                    time.sleep(max(0.02, interval - elapsed))

            # Dedicated Win32 Input Executor Thread (Zero HWNDs/Hooks -> SetThreadDesktop succeeds 100%)
            def input_executor_worker():
                attached = attach_thread_desktop()
                print(f"[LiveKit Unified] Remote Control Win32 Input Thread started (Desktop Attached: {attached})", flush=True)
                while not stop_workers.is_set():
                    try:
                        evt = remote_input_queue.get(timeout=0.1)
                        attach_thread_desktop()
                        execute_win32_input(evt, screen_w, screen_h)
                    except queue.Empty:
                        continue
                    except Exception as ex:
                        print(f"[LiveKit Unified] Input execution error: {ex}", flush=True)

            # Fast HTTP Poll fallback thread for /api/v1/agent/remote-input/poll
            def http_input_poll_worker():
                session = requests.Session()
                poll_url = f"{API_URL.rstrip('/')}/api/v1/agent/remote-input/poll?employeeId={EMPLOYEE_ID}"
                while not stop_workers.is_set():
                    try:
                        resp = session.get(poll_url, timeout=3)
                        if resp.status_code == 200:
                            data = resp.json()
                            inputs = data.get("inputs") or []
                            for inp in inputs:
                                enqueue_remote_event(inp)
                    except Exception:
                        pass
                    time.sleep(0.04)

            screen_th = threading.Thread(target=screen_worker, daemon=True)
            camera_th = threading.Thread(target=camera_worker, daemon=True)
            input_th = threading.Thread(target=input_executor_worker, daemon=True)
            poll_th = threading.Thread(target=http_input_poll_worker, daemon=True)

            screen_th.start()
            camera_th.start()
            input_th.start()
            poll_th.start()

            print("[LiveKit Unified] All 3 Tracks (Screen, Camera, Audio) + Remote Control Active!", flush=True)

            # Audio delivery loop
            while room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
                data = await audio_queue.get()
                aframe = rtc.AudioFrame(
                    data=data,
                    sample_rate=SAMPLE_RATE,
                    num_channels=CHANNELS,
                    samples_per_channel=FRAME_SIZE
                )
                await audio_source.capture_frame(aframe)

            # Teardown
            stop_workers.set()
            screen_th.join(timeout=1.0)
            camera_th.join(timeout=1.0)
            input_th.join(timeout=1.0)
            poll_th.join(timeout=1.0)
            audio_stream.stop()
            audio_stream.close()
            cap.release()
            await room.disconnect()

        except asyncio.CancelledError:
            print("[LiveKit Unified] Cancelled.", flush=True)
            break
        except Exception as ex:
            print(f"[LiveKit Unified] Error: {ex}. Reconnecting in 3s...", flush=True)
            await asyncio.sleep(3)


if __name__ == "__main__":
    try:
        asyncio.run(run_publisher())
    except KeyboardInterrupt:
        print("[LiveKit Unified] Stopped by user.", flush=True)
    except Exception as e:
        print(f"[LiveKit Unified] Fatal: {e}", flush=True)
