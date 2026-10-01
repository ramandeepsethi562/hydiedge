package com.hydiedge.mobile.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.hydiedge.mobile.api.HydiEdgeApiClient
import com.hydiedge.mobile.location.GpsBreadcrumbService
import com.hydiedge.mobile.model.TelephonyBatchPayload
import com.hydiedge.mobile.screentime.ScreenTimeTracker
import com.hydiedge.mobile.telephony.TelephonyCallReceiver
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class BatchSyncWorker(
    private val appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        const val TAG = "BatchSyncWorker"
        const val WORK_NAME = "hydiedge_batch_sync_work"
        private const val PREFS_SETTINGS = "hydiedge_settings"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_EMP_ID = "employee_id"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_LAST_SYNC_TIME = "last_sync_time"

        fun getLastSyncTime(context: Context): String {
            val prefs = context.getSharedPreferences(PREFS_SETTINGS, Context.MODE_PRIVATE)
            return prefs.getString(KEY_LAST_SYNC_TIME, "Never") ?: "Never"
        }

        fun saveLastSyncTime(context: Context, timeStr: String) {
            val prefs = context.getSharedPreferences(PREFS_SETTINGS, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_LAST_SYNC_TIME, timeStr).apply()
        }

        fun getConfig(context: Context): Triple<String, String, String> {
            val prefs = context.getSharedPreferences(PREFS_SETTINGS, Context.MODE_PRIVATE)
            val serverUrl = prefs.getString(KEY_SERVER_URL, "https://api.hydiedge.com") ?: "https://api.hydiedge.com"
            val empId = prefs.getString(KEY_EMP_ID, "emp-win-ramandeep") ?: "emp-win-ramandeep"
            val devId = prefs.getString(KEY_DEVICE_ID, "ANDROID-S24-ULTRA") ?: "ANDROID-S24-ULTRA"
            return Triple(serverUrl, empId, devId)
        }

        fun saveConfig(context: Context, serverUrl: String, empId: String, devId: String) {
            val prefs = context.getSharedPreferences(PREFS_SETTINGS, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(KEY_SERVER_URL, serverUrl)
                .putString(KEY_EMP_ID, empId)
                .putString(KEY_DEVICE_ID, devId)
                .apply()
        }
    }

    override suspend fun doWork(): Result {
        Log.d(TAG, "Starting periodic HydiEdge batch synchronization...")

        val (serverUrl, empId, devId) = getConfig(appContext)

        // 1. Gather Telephony Calls from Spool
        val pendingCalls = TelephonyCallReceiver.getBufferedCalls(appContext)

        // 2. Gather Screen Time from UsageStatsManager
        val screenTimeTracker = ScreenTimeTracker(appContext)
        val dailyScreenTime = screenTimeTracker.collectDailyScreenTime()

        // 3. Gather GPS Breadcrumbs from Spool
        val pendingBreadcrumbs = GpsBreadcrumbService.getBufferedBreadcrumbs(appContext)

        // If there is zero data, nothing to sync
        if (pendingCalls.isEmpty() && dailyScreenTime.isEmpty() && pendingBreadcrumbs.isEmpty()) {
            Log.d(TAG, "No telemetry data to sync at this time.")
            return Result.success()
        }

        val payload = TelephonyBatchPayload(
            employeeId = empId,
            deviceId = devId,
            calls = if (pendingCalls.isNotEmpty()) pendingCalls else null,
            screenTime = if (dailyScreenTime.isNotEmpty()) dailyScreenTime else null,
            contacts = null,
            breadcrumbs = if (pendingBreadcrumbs.isNotEmpty()) pendingBreadcrumbs else null
        )

        return try {
            val apiService = HydiEdgeApiClient.createService(serverUrl)
            val response = apiService.postTelephonyBatch(
                authHeader = "Bearer mock-hydiedge-mobile-token",
                orgId = "org-acme-global-001",
                payload = payload
            )

            if (response.isSuccessful && response.body()?.success == true) {
                val respBody = response.body()!!
                Log.d(TAG, "Sync Successful! Ingested: ${respBody.callsCount} calls, ${respBody.screenTimeCount} screen time records, ${respBody.breadcrumbsCount} breadcrumbs")

                // Clear spools that were successfully acknowledged by the server
                TelephonyCallReceiver.clearBufferedCalls(appContext)
                GpsBreadcrumbService.clearBufferedBreadcrumbs(appContext)

                val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
                saveLastSyncTime(appContext, sdf.format(Date()))

                Result.success()
            } else {
                Log.e(TAG, "Server returned error: ${response.code()} ${response.message()}")
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Sync failed with exception: ${e.message}", e)
            Result.retry()
        }
    }
}
