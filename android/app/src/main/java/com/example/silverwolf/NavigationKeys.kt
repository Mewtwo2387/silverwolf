package com.example.silverwolf

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

@Serializable data object Main : NavKey

@Serializable data object Dashboard : NavKey

@Serializable data object Leaderboards : NavKey

@Serializable data object Birthdays : NavKey
