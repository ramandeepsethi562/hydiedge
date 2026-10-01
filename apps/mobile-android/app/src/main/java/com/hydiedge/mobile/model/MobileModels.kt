package com.hydiedge.mobile.model

import com.google.gson.annotations.SerializedName

data class CallLogEntry(
    @SerializedName("caller_name") val callerName: String,
    @SerializedName("phone_number") val phoneNumber: String,
    @SerializedName("call_type") val callType: String, // INCOMING, OUTGOING, MISSED, REJECTED
    @SerializedName("call_time_utc") val callTimeUtc: String,
    @SerializedName("duration_seconds") val durationSeconds: Int,
    @SerializedName("audio_url") val audioUrl: String? = null,
    @SerializedName("notes") val notes: String? = null
)

data class ScreenTimeEntry(
    @SerializedName("package_name") val packageName: String,
    @SerializedName("app_name") val appName: String,
    @SerializedName("category") val category: String, // PRODUCTIVE, NEUTRAL, NON_PRODUCTIVE
    @SerializedName("screen_time_seconds") val screenTimeSeconds: Int
)

data class ContactEntry(
    @SerializedName("contact_name") val contactName: String,
    @SerializedName("phone_number") val phoneNumber: String,
    @SerializedName("email") val email: String? = null
)

data class GpsBreadcrumbEntry(
    @SerializedName("latitude") val latitude: Double,
    @SerializedName("longitude") val longitude: Double,
    @SerializedName("accuracy_meters") val accuracyMeters: Float,
    @SerializedName("speed_kmh") val speedKmh: Float,
    @SerializedName("battery_pct") val batteryPct: Int,
    @SerializedName("is_mock_location") val isMockLocation: Boolean,
    @SerializedName("recorded_at_utc") val recordedAtUtc: String
)

data class TelephonyBatchPayload(
    @SerializedName("employee_id") val employeeId: String,
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("calls") val calls: List<CallLogEntry>? = null,
    @SerializedName("screen_time") val screenTime: List<ScreenTimeEntry>? = null,
    @SerializedName("contacts") val contacts: List<ContactEntry>? = null,
    @SerializedName("breadcrumbs") val breadcrumbs: List<GpsBreadcrumbEntry>? = null
)

data class TelephonyBatchResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("processed") val processed: Boolean,
    @SerializedName("callsCount") val callsCount: Int,
    @SerializedName("screenTimeCount") val screenTimeCount: Int,
    @SerializedName("contactsCount") val contactsCount: Int,
    @SerializedName("breadcrumbsCount") val breadcrumbsCount: Int,
    @SerializedName("timestamp") val timestamp: String? = null
)
