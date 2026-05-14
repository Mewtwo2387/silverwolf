use crate::{Context, Error};
use poise::serenity_prelude as serenity;
use scraper::{Html, Selector};
use chrono::Datelike;

struct DriverEntry {
    position: i32,
    driver: String,
    nationality: String,
    car: String,
    points: i32,
}

struct TeamEntry {
    position: i32,
    team: String,
    points: i32,
}

#[derive(poise::ChoiceParameter, Debug, Clone, Copy, PartialEq, Eq)]
pub enum StandingsType {
    #[name = "drivers"]
    Drivers,
    #[name = "teams"]
    Teams,
}

/// Fetch F1 standings (drivers or constructors)
#[poise::command(slash_command, rename = "f1-standings")]
pub async fn f1_standings(
    ctx: Context<'_>,
    #[description = "Choose between driver or constructor standings"]
    standings_type: StandingsType,
    #[description = "Select a year (default: current year)"]
    year: Option<i32>,
) -> Result<(), Error> {
    ctx.defer().await?;

    let current_year = chrono::Utc::now().year();
    let year = year.unwrap_or(current_year);

    let min_year = if standings_type == StandingsType::Drivers { 1950 } else { 1958 };

    if year > current_year || year < min_year {
        ctx.say(format!(
            "Invalid year for {:?} standings. Must be between {} and {}.",
            standings_type, min_year, current_year
        )).await?;
        return Ok(());
    }

    let endpoint = if standings_type == StandingsType::Drivers { "drivers" } else { "team" };
    let url = format!("https://www.formula1.com/en/results/{}/{}", year, endpoint);

    let response = ctx.data().http_client.get(&url).send().await?.text().await?;
    
    let embed = {
        let document = Html::parse_document(&response);
        let table_selector = Selector::parse("#results-table tbody tr").unwrap();
        let mut embed = serenity::CreateEmbed::new()
            .thumbnail("https://logodownload.org/wp-content/uploads/2016/11/formula-1-logo-0.png")
            .footer(serenity::CreateEmbedFooter::new("Data provided by Formula1.com"))
            .timestamp(serenity::Timestamp::now());

        if standings_type == StandingsType::Drivers {
            let mut drivers = Vec::new();
            for element in document.select(&table_selector) {
                let cols: Vec<_> = element.select(&Selector::parse("td").unwrap()).collect();
                if cols.len() >= 5 {
                    let position = cols[0].text().collect::<String>().trim().parse::<i32>().unwrap_or(0);
                    
                    // Driver name is complex in the HTML
                    let driver_link = cols[1].select(&Selector::parse("a").unwrap()).next();
                    let driver_name = if let Some(link) = driver_link {
                        let spans: Vec<_> = link.select(&Selector::parse("span").unwrap()).collect();
                        if spans.len() >= 2 {
                            let first = spans[0].text().collect::<String>();
                            let last = spans[1].text().collect::<String>();
                            format!("{} {}", first.trim(), last.trim()).trim().to_string()
                        } else {
                            link.text().collect::<String>().trim().to_string()
                        }
                    } else {
                        cols[1].text().collect::<String>().trim().to_string()
                    };

                    let nationality = cols[2].text().collect::<String>().trim().to_string();
                    let car = cols[3].text().collect::<String>().trim().to_string();
                    let points = cols[4].text().collect::<String>().trim().parse::<i32>().unwrap_or(0);

                    drivers.push(DriverEntry { position, driver: driver_name, nationality, car, points });
                }
            }

            let description = drivers.iter().take(25).map(|e| {
                format!("{}. **{}** ({}) - Car: {}, Points: {}", e.position, e.driver, e.nationality, e.car, e.points)
            }).collect::<Vec<_>>().join("\n");

            embed = embed.title(format!("F1 Driver Standings ({})", year))
                .color(0xFF0000)
                .description(description);
        } else {
            let mut teams = Vec::new();
            for element in document.select(&table_selector) {
                let cols: Vec<_> = element.select(&Selector::parse("td").unwrap()).collect();
                if cols.len() >= 3 {
                    let position = cols[0].text().collect::<String>().trim().parse::<i32>().unwrap_or(0);
                    let team = cols[1].text().collect::<String>().trim().to_string();
                    let points = cols[2].text().collect::<String>().trim().parse::<i32>().unwrap_or(0);

                    teams.push(TeamEntry { position, team, points });
                }
            }

            let description = teams.iter().take(10).map(|e| {
                format!("{}. **{}** - Points: {}", e.position, e.team, e.points)
            }).collect::<Vec<_>>().join("\n");

            embed = embed.title(format!("F1 Team Standings ({})", year))
                .color(0x008000)
                .description(description);
        }
        embed
    };

    ctx.send(poise::CreateReply::default().embed(embed)).await?;

    Ok(())
}
