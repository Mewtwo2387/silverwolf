package com.example.silverwolf.data

import kotlinx.serialization.json.JsonObject
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Retrofit interface for the Silverwolf backend JSON API.
 *
 * Read endpoints under `api/` were added for native clients (see `site_src/routes/app-api.ts`).
 * Game action endpoints under `games/` already existed for the web UI; they require the CSRF
 * token in the JSON body — [AuthInterceptor] does NOT inject it, callers pass it explicitly.
 */
interface SilverwolfApi {
    @GET("api/me/csrf")
    suspend fun getCsrf(): CsrfResponse

    @GET("api/me/profile")
    suspend fun getProfile(): ProfileResponse

    @GET("api/leaderboards/{board}")
    suspend fun getLeaderboard(@Path("board") board: String): LeaderboardResponse

    @GET("api/birthdays")
    suspend fun getBirthdays(): Map<String, List<BirthdayUser>>

    // --- Game actions (existing endpoints). Body must include `csrf`. ---

    @POST("games/blackjack/start")
    suspend fun blackjackStart(@Body body: JsonObject): GameResponse

    @POST("games/blackjack/hit")
    suspend fun blackjackHit(@Body body: JsonObject): GameResponse

    @POST("games/blackjack/stand")
    suspend fun blackjackStand(@Body body: JsonObject): GameResponse

    @POST("games/roulette/play")
    suspend fun roulettePlay(@Body body: JsonObject): GameResponse

    @POST("games/slots/play")
    suspend fun slotsPlay(@Body body: JsonObject): GameResponse

    @POST("games/claim/claim")
    suspend fun claim(@Body body: JsonObject): GameResponse
}
