package com.example.silverwolf.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Response of `GET /api/me/csrf`. */
@Serializable
data class CsrfResponse(val csrf: String)

/**
 * Response of `GET /api/me/profile`. The nested `stats`/`marriageBenefits`/`poopStats`/
 * `poopProfile` objects are kept as raw [JsonElement] for now — their exact shapes live
 * server-side and the UI only reads a handful of fields. Tighten to typed models as the
 * dashboard UI is built out.
 */
@Serializable
data class ProfileResponse(
    val discordId: String,
    val username: String,
    val avatarURL: String? = null,
    val pokemonCount: Int = 0,
    val stats: JsonElement? = null,
    val marriageBenefits: JsonElement? = null,
    val poopStats: JsonElement? = null,
    val poopProfile: JsonElement? = null,
)

/** Response of `GET /api/leaderboards/:board` — mirrors backend `LeaderboardResult`. */
@Serializable
data class LeaderboardResponse(
    val title: String,
    val rows: List<LeaderboardRow> = emptyList(),
)

@Serializable
data class LeaderboardRow(
    val rank: Int,
    val username: String,
    val avatarURL: String? = null,
    val value: Double,
    val valueLabel: String,
    val valueTitle: String? = null,
)

/** One entry in `GET /api/birthdays` (keyed by month name → list). */
@Serializable
data class BirthdayUser(
    val id: String,
    val username: String,
    val avatarURL: String? = null,
    val nextBirthday: String,
    val day: Int,
)

/** Generic envelope used by most game POST endpoints: `{ ok, data?, error? }`. */
@Serializable
data class GameResponse(
    val ok: Boolean = false,
    val data: JsonElement? = null,
    val error: String? = null,
    @SerialName("retryAfter") val retryAfter: Int? = null,
)
