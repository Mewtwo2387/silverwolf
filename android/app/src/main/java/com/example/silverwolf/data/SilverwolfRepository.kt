package com.example.silverwolf.data

import kotlinx.coroutines.flow.Flow

/**
 * Single entry point for the UI layer to reach the backend. Rebuilds the [SilverwolfApi]
 * whenever the configured server URL changes, and owns the login → CSRF-fetch handshake.
 */
class SilverwolfRepository(private val store: SessionStore) {
    @Volatile private var cachedBaseUrl: String? = null
    @Volatile private var cachedApi: SilverwolfApi? = null

    val isLoggedIn: Flow<String?> get() = store.sessionToken
    val serverUrl: Flow<String> get() = store.serverUrl

    private suspend fun api(): SilverwolfApi {
        val base = store.currentServerUrl()
        val current = cachedApi
        if (current != null && cachedBaseUrl == base) return current
        val built = ApiClient.create(base, store)
        cachedApi = built
        cachedBaseUrl = base
        return built
    }

    /**
     * Called when the `silverwolf://login?session=` deep link arrives: persist the session
     * token, then fetch and cache the per-session CSRF token for subsequent game POSTs.
     */
    suspend fun onLogin(sessionToken: String) {
        store.setSessionToken(sessionToken)
        val csrf = api().getCsrf().csrf
        store.setCsrfToken(csrf)
    }

    suspend fun logout() = store.clear()

    suspend fun setServerUrl(url: String) = store.setServerUrl(url)

    suspend fun getProfile(): ProfileResponse = api().getProfile()

    suspend fun getLeaderboard(board: String): LeaderboardResponse = api().getLeaderboard(board)

    suspend fun getBirthdays(): Map<String, List<BirthdayUser>> = api().getBirthdays()
}
