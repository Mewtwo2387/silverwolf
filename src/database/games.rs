use crate::database::models::GameUid;

impl super::Database {
    pub async fn get_all_game_uids(&self, user_id: &str) -> anyhow::Result<Vec<GameUid>> {
        let uids = sqlx::query_as::<_, GameUid>("SELECT * FROM GameUID WHERE user_id = ?")
            .bind(user_id)
            .fetch_all(&self.pool)
            .await?;
        Ok(uids)
    }

    pub async fn get_game_uid(&self, user_id: &str, game: &str) -> anyhow::Result<Option<GameUid>> {
        let uid = sqlx::query_as::<_, GameUid>("SELECT * FROM GameUID WHERE user_id = ? AND game = ?")
            .bind(user_id)
            .bind(game)
            .fetch_optional(&self.pool)
            .await?;
        Ok(uid)
    }

    pub async fn set_game_uid(&self, user_id: &str, game: &str, game_uid: &str, region: Option<&str>) -> anyhow::Result<()> {
        sqlx::query("INSERT OR REPLACE INTO GameUID (user_id, game, game_uid, region) VALUES (?, ?, ?, ?)")
            .bind(user_id)
            .bind(game)
            .bind(game_uid)
            .bind(region)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_game_uid(&self, user_id: &str, game: &str) -> anyhow::Result<bool> {
        let res = sqlx::query("DELETE FROM GameUID WHERE user_id = ? AND game = ?")
            .bind(user_id)
            .bind(game)
            .execute(&self.pool)
            .await?;
        Ok(res.rows_affected() > 0)
    }

    pub async fn record_blackjack_win(&self, user_id: &str, amount: f64) -> anyhow::Result<(f64, i64, f64)> {
        let user = self.get_user(user_id).await?;
        let benefits = self.get_marriage_benefits(user_id).await?;
        
        let multi = benefits * 2.1 * 1.08f64.powi(user.blackjack_streak as i32);
        let new_streak = user.blackjack_streak + 1;
        let winnings = amount * multi;

        sqlx::query(
            "UPDATE User SET \
             blackjack_times_played = blackjack_times_played + 1, \
             blackjack_amount_gambled = blackjack_amount_gambled + ?, \
             blackjack_times_won = blackjack_times_won + 1, \
             blackjack_amount_won = blackjack_amount_won + ?, \
             blackjack_relative_won = blackjack_relative_won + ?, \
             credits = credits + ?, \
             blackjack_streak = ?, \
             blackjack_max_streak = MAX(blackjack_max_streak, ?) \
             WHERE id = ?"
        )
        .bind(amount)
        .bind(winnings)
        .bind(multi)
        .bind(winnings - amount)
        .bind(new_streak)
        .bind(new_streak)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok((multi, new_streak, winnings))
    }

    pub async fn record_blackjack_loss(&self, user_id: &str, amount: f64) -> anyhow::Result<()> {
        sqlx::query(
            "UPDATE User SET \
             blackjack_times_played = blackjack_times_played + 1, \
             blackjack_amount_gambled = blackjack_amount_gambled + ?, \
             blackjack_times_lost = blackjack_times_lost + 1, \
             credits = credits - ?, \
             blackjack_streak = 0 \
             WHERE id = ?"
        )
        .bind(amount)
        .bind(amount)
        .bind(user_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn record_blackjack_tie(&self, user_id: &str, amount: f64) -> anyhow::Result<()> {
        sqlx::query(
            "UPDATE User SET \
             blackjack_times_played = blackjack_times_played + 1, \
             blackjack_amount_gambled = blackjack_amount_gambled + ?, \
             blackjack_times_drawn = blackjack_times_drawn + 1, \
             blackjack_amount_won = blackjack_amount_won + ?, \
             blackjack_relative_won = blackjack_relative_won + 1 \
             WHERE id = ?"
        )
        .bind(amount)
        .bind(amount)
        .bind(user_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn record_slots_result(&self, user_id: &str, amount: f64, multi: f64) -> anyhow::Result<f64> {
        let winnings = multi * amount;
        let net_profit = winnings - amount;

        sqlx::query(
            "UPDATE User SET \
             slots_times_played = slots_times_played + 1, \
             slots_amount_gambled = slots_amount_gambled + ?, \
             slots_times_won = slots_times_won + ?, \
             slots_amount_won = slots_amount_won + ?, \
             slots_relative_won = slots_relative_won + ?, \
             credits = credits + ? \
             WHERE id = ?"
        )
        .bind(amount)
        .bind(if net_profit > 0.0 { 1 } else { 0 })
        .bind(winnings)
        .bind(multi)
        .bind(net_profit)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(winnings)
    }

    pub async fn record_roulette_result(
        &self, 
        user_id: &str, 
        amount: f64, 
        multi: f64, 
        new_streak: i64
    ) -> anyhow::Result<f64> {
        let winnings = multi * amount;
        let net_profit = winnings - amount;

        sqlx::query(
            "UPDATE User SET \
             roulette_times_played = roulette_times_played + 1, \
             roulette_amount_gambled = roulette_amount_gambled + ?, \
             roulette_times_won = roulette_times_won + ?, \
             roulette_amount_won = roulette_amount_won + ?, \
             roulette_relative_won = roulette_relative_won + ?, \
             credits = credits + ?, \
             roulette_streak = ?, \
             roulette_max_streak = MAX(roulette_max_streak, ?) \
             WHERE id = ?"
        )
        .bind(amount)
        .bind(if multi > 0.0 { 1 } else { 0 })
        .bind(winnings)
        .bind(multi)
        .bind(net_profit)
        .bind(new_streak)
        .bind(new_streak)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(winnings)
    }
}
