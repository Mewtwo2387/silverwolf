package com.example.silverwolf.data

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Response
import retrofit2.Retrofit

/**
 * Injects `Authorization: Bearer <sessionToken>` on every request. The token is the signed
 * session token from the OAuth deep link; the backend verifies it identically to the
 * `sw_session` cookie (see `readBearerSessionId`). CSRF is NOT injected here — game POSTs
 * carry it in the JSON body.
 */
class AuthInterceptor(private val store: SessionStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { store.currentSessionToken() }
        val request = if (token.isNullOrEmpty()) {
            chain.request()
        } else {
            chain.request().newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        }
        return chain.proceed(request)
    }
}

/**
 * Builds a [SilverwolfApi] bound to the current server URL. The base URL can change at
 * runtime (settings), so callers rebuild via [create] when it does.
 */
object ApiClient {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    fun create(baseUrl: String, store: SessionStore): SilverwolfApi {
        val normalized = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(store))
            .build()
        return Retrofit.Builder()
            .baseUrl(normalized)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(SilverwolfApi::class.java)
    }
}
