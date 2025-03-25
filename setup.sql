--
-- Structure de la table `guild_settings`
--

CREATE TABLE `guild_settings` (
  `guild_id` varchar(255) NOT NULL,
  `log_channel` varchar(255) DEFAULT NULL,
  `allowed_role` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `user_hours`
--

CREATE TABLE `user_hours` (
  `guild_id` varchar(255) NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `clock_in` datetime NOT NULL,
  `clock_out` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Index pour la table `guild_settings`
--
ALTER TABLE `guild_settings`
  ADD PRIMARY KEY (`guild_id`);

--
-- Index pour la table `user_hours`
--
ALTER TABLE `user_hours`
  ADD PRIMARY KEY (`guild_id`,`user_id`,`clock_in`) USING BTREE;
COMMIT;
