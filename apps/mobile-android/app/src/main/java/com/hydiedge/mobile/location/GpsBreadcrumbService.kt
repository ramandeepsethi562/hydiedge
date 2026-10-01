package com.hydiedge.mobile.location

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Location
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.hydiedge.mobile.model.GpsBreadcrumbEntry
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class GpsBreadcrumbService : Service() {

    companion object {
        private const val TAG = "GpsBreadcrumbService"
        private const val CHANNEL_ID = "hydiedge_field_gps_channel"
        private const val NOTIFICATION_ID = 2026
        private const val PREFS_NAME = "hydiedge_gps_spool"
        private const val KEY_PENDING_BREADCRUMBS = "pending_breadcrumbs"

        fun getBufferedBreadcrumbs(context: Context): List<GpsBreadcrumbEntry> {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString(KEY_PENDING_BREADCRUMBS, null) ?: return emptyList()
            val type = object : TypeToken<List<GpsBreadcrumbEntry>>() {}.type
            return try {
                Gson().fromJson(json, type) ?: emptyList()
            } catch (e: Exception) {
                emptyList()
            }
        }

        fun clearBufferedBreadcrumbs(context: Context) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().remove(KEY_PENDING_BREADCRUMBS).apply()
        }

        fun saveBreadcrumbToSpool(context: Context, entry: GpsBreadcrumbEntry) {
            val current = getBufferedBreadcrumbs(context).toMutableList()
            current.add(entry)
            // Limit in-memory spool to 500 points to prevent OOM
            if (current.size > 500) {
                current.removeAt(0)
            }
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_PENDING_BREADCRUMBS, Gson().toJson(current)).apply()
        }
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                for (location in result.locations) {
                    processLocation(location)
                }
            }
        }

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildForegroundNotification())
        startLocationUpdates()
    }

    private fun processLocation(location: Location) {
        val batteryPct = getBatteryPercentage()
        val isMock = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            location.isMock
        } else {
            @Suppress("DEPRECATION")
            location.isFromMockProvider
        }

        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val recordedAtUtc = sdf.format(Date(location.time))

        val entry = GpsBreadcrumbEntry(
            latitude = location.latitude,
            longitude = location.longitude,
            accuracyMeters = location.accuracy,
            speedKmh = location.speed * 3.6f, // Convert m/s to km/h
            batteryPct = batteryPct,
            isMockLocation = isMock,
            recordedAtUtc = recordedAtUtc
        )

        saveBreadcrumbToSpool(this, entry)
        Log.d(TAG, "GPS Breadcrumb saved: Lat ${entry.latitude}, Lng ${entry.longitude}, Speed ${entry.speedKmh} km/h")
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 60_000L)
            .setMinUpdateIntervalMillis(30_000L)
            .setMinUpdateDistanceMeters(10.0f) // Update only if moved >= 10 meters
            .build()

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
            Log.d(TAG, "Continuous high-accuracy GPS tracking initiated (60s interval)")
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission missing: ${e.message}")
        }
    }

    private fun getBatteryPercentage(): Int {
        val iFilter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        val batteryStatus = registerReceiver(null, iFilter)
        val level = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        return if (level >= 0 && scale > 0) {
            (level * 100 / scale)
        } else 85
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "HydiEdge Field GPS Tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors route compliance, distance and customer visits"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("HydiEdge Field Workforce Active")
            .setContentText("Continuous GPS breadcrumbs and telephony logging enabled")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        Log.d(TAG, "GpsBreadcrumbService stopped")
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
