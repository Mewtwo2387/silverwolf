package com.example.silverwolf.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "silverwolf_session")

/**
 * Persists the signed session token (delivered via the `silverwolf://login?session=`
 * deep link) and the per-session CSRF token, plus the configurable server URL.
 *
 * The session token is the same value the web app stores in the `sw_session` cookie;
 * here it is sent as `Authorization: Bearer <token>` (see [AuthInterceptor] and the
 * backend's `readBearerSessionId`). The CSRF token is fetched once from
 * `/api/me/csrf` after login and attached to every game POST body.
 */
class SessionStore(private val context: Context) {
    private object Keys {
        val SESSION_TOKEN = stringPreferencesKey("session_token")
        val CSRF_TOKEN = stringPreferencesKey("csrf_token")
        val SERVER_URL = stringPreferencesKey("server_url")
    }

    val sessionToken: Flow<String?> = context.dataStore.data.map { it[Keys.SESSION_TOKEN] }
    val csrfToken: Flow<String?> = context.dataStore.data.map { it[Keys.CSRF_TOKEN] }
    val serverUrl: Flow<String> = context.dataStore.data.map { it[Keys.SERVER_URL] ?: DEFAULT_SERVER_URL }

    suspend fun currentSessionToken(): String? = sessionToken.first()
    suspend fun currentCsrfToken(): String? = csrfToken.first()
    suspend fun currentServerUrl(): String = serverUrl.first()

    suspend fun setSessionToken(token: String) {
        context.dataStore.edit { it[Keys.SESSION_TOKEN] = token }
    }

    suspend fun setCsrfToken(token: String) {
        context.dataStore.edit { it[Keys.CSRF_TOKEN] = token }
    }

    suspend fun setServerUrl(url: String) {
        context.dataStore.edit { it[Keys.SERVER_URL] = url }
    }

    suspend fun clear() {
        context.dataStore.edit {
            it.remove(Keys.SESSION_TOKEN)
            it.remove(Keys.CSRF_TOKEN)
        }
    }

    companion object {
        // 10.0.2.2 maps to the host machine's localhost from the Android emulator.
        const val DEFAULT_SERVER_URL = "http://10.0.2.2:6769"
    }
}
