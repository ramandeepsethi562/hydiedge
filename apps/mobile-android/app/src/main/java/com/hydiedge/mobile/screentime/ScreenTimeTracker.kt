package com.hydiedge.mobile.screentime

import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.util.Log
import com.hydiedge.mobile.model.ScreenTimeEntry
import java.util.Calendar

class ScreenTimeTracker(private val context: Context) {

    companion object {
        private const val TAG = "ScreenTimeTracker"

        // Default heuristic classifications for Android apps
        private val PRODUCTIVE_PACKAGES = setOf(
            "com.google.android.gm",           // Gmail
            "com.google.android.apps.docs",    // Docs
            "com.google.android.apps.sheets",  // Sheets
            "com.slack",                       // Slack
            "com.microsoft.teams",             // Teams
            "com.microsoft.office.outlook",    // Outlook
            "com.google.android.apps.tachyon", // Google Meet
            "com.salesforce",                  // Salesforce
            "com.hydiedge.mobile"              // HydiEdge App
        )

        private val NON_PRODUCTIVE_PACKAGES = setOf(
            "com.instagram.android",
            "com.facebook.katana",
            "com.tiktok.android",
            "com.netflix.mediaclient",
            "com.snapchat.android",
            "com.twitter.android",
            "com.zhiliaoapp.musically"
        )
    }

    fun collectDailyScreenTime(): List<ScreenTimeEntry> {
        val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            ?: return emptyList()

        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val startTime = calendar.timeInMillis
        val endTime = System.currentTimeMillis()

        val usageStatsList: List<UsageStats> = usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            startTime,
            endTime
        ) ?: emptyList()

        val packageManager = context.packageManager
        val entries = mutableListOf<ScreenTimeEntry>()

        for (stats in usageStatsList) {
            val totalTimeSec = (stats.totalTimeInForeground / 1000).toInt()
            if (totalTimeSec <= 10) continue // Skip micro-interactions < 10 seconds

            val pkg = stats.packageName
            val appName = try {
                val appInfo: ApplicationInfo = packageManager.getApplicationInfo(pkg, 0)
                packageManager.getApplicationLabel(appInfo).toString()
            } catch (e: PackageManager.NameNotFoundException) {
                pkg.substringAfterLast(".")
            }

            val category = when {
                PRODUCTIVE_PACKAGES.any { pkg.startsWith(it, ignoreCase = true) } -> "PRODUCTIVE"
                NON_PRODUCTIVE_PACKAGES.any { pkg.startsWith(it, ignoreCase = true) } -> "NON_PRODUCTIVE"
                else -> "NEUTRAL"
            }

            entries.add(
                ScreenTimeEntry(
                    packageName = pkg,
                    appName = appName,
                    category = category,
                    screenTimeSeconds = totalTimeSec
                )
            )
        }

        Log.d(TAG, "Aggregated ${entries.size} active apps from UsageStatsManager")
        return entries.sortedByDescending { it.screenTimeSeconds }
    }
}
