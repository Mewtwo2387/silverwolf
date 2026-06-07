package com.example.silverwolf.ui.dashboard

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.example.silverwolf.SilverwolfApp
import com.example.silverwolf.data.ProfileResponse
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

@Composable
fun DashboardScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val app = context.applicationContext as SilverwolfApp
    val viewModel: DashboardViewModel = viewModel(factory = DashboardViewModel.Factory(app.repository))
    val state by viewModel.uiState.collectAsState()

    when (val s = state) {
        is DashboardUiState.Loading -> CenteredBox(modifier) { CircularProgressIndicator() }

        is DashboardUiState.LoggedOut -> CenteredBox(modifier) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Not logged in", style = MaterialTheme.typography.titleMedium)
                Button(onClick = {
                    val serverUrl = runBlocking { app.sessionStore.currentServerUrl() }
                    val uri = Uri.parse("$serverUrl/auth/discord/login?app=true")
                    context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                }) { Text("Log in with Discord") }
            }
        }

        is DashboardUiState.Error -> CenteredBox(modifier) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Couldn't load dashboard", style = MaterialTheme.typography.titleMedium)
                Text(s.message, style = MaterialTheme.typography.bodySmall)
                Button(onClick = { viewModel.refresh() }) { Text("Retry") }
            }
        }

        is DashboardUiState.Success -> ProfileContent(s.profile, modifier)
    }
}

@Composable
private fun ProfileContent(profile: ProfileResponse, modifier: Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            if (profile.avatarURL != null) {
                AsyncImage(
                    model = profile.avatarURL,
                    contentDescription = "Avatar",
                    modifier = Modifier.size(64.dp).clip(CircleShape),
                )
            }
            Column {
                Text(profile.username, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text("Unique Pokémon: ${profile.pokemonCount}", style = MaterialTheme.typography.bodyMedium)
            }
        }

        StatsCard("Stats", profile.stats as? JsonObject)
        StatsCard("Poop stats", profile.poopStats as? JsonObject)
        StatsCard("Marriage benefits", profile.marriageBenefits as? JsonObject)
    }
}

/** Renders the flat primitive fields of an arbitrary JSON object as label/value rows. */
@Composable
private fun StatsCard(title: String, obj: JsonObject?) {
    if (obj == null || obj.isEmpty()) return
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            HorizontalDivider()
            obj.entries.forEach { (key, value) ->
                val primitive = value as? JsonPrimitive
                if (primitive != null) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(key, style = MaterialTheme.typography.bodyMedium)
                        Text(primitive.content, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                    }
                }
            }
        }
    }
}

@Composable
private fun CenteredBox(modifier: Modifier, content: @Composable () -> Unit) {
    Column(modifier = modifier.fillMaxSize().wrapContentSize(Alignment.Center)) { content() }
}
