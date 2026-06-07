package com.example.silverwolf

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.example.silverwolf.ui.birthdays.BirthdaysScreen
import com.example.silverwolf.ui.dashboard.DashboardScreen
import com.example.silverwolf.ui.leaderboards.LeaderboardsScreen
import com.example.silverwolf.ui.main.MainScreen

@Composable
fun MainNavigation() {
  val backStack = rememberNavBackStack(Main)

  NavDisplay(
    backStack = backStack,
    onBack = { backStack.removeLastOrNull() },
    entryProvider =
      entryProvider {
        entry<Main> {
          MainScreen(onItemClick = { navKey -> backStack.add(navKey) }, modifier = Modifier.safeDrawingPadding().padding(16.dp))
        }
        entry<Dashboard> {
          DashboardScreen(modifier = Modifier.safeDrawingPadding())
        }
        entry<Leaderboards> {
          LeaderboardsScreen(modifier = Modifier.safeDrawingPadding())
        }
        entry<Birthdays> {
          BirthdaysScreen(modifier = Modifier.safeDrawingPadding())
        }
      },
  )
}
