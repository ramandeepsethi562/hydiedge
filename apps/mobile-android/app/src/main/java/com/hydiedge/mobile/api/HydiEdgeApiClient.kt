package com.hydiedge.mobile.api

import com.hydiedge.mobile.model.TelephonyBatchPayload
import com.hydiedge.mobile.model.TelephonyBatchResponse
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST
import java.util.concurrent.TimeUnit

interface HydiEdgeApiService {
    @POST("api/v1/mobile/telephony-batch")
    suspend fun postTelephonyBatch(
        @Header("Authorization") authHeader: String?,
        @Header("X-Tenant-Org-Id") orgId: String?,
        @Body payload: TelephonyBatchPayload
    ): Response<TelephonyBatchResponse>
}

object HydiEdgeApiClient {
    private const val DEFAULT_BASE_URL = "https://api.hydiedge.com/"

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        })
        .build()

    fun createService(baseUrl: String = DEFAULT_BASE_URL): HydiEdgeApiService {
        val normalizedUrl = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
        return Retrofit.Builder()
            .baseUrl(normalizedUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(HydiEdgeApiService::class.java)
    }
}
