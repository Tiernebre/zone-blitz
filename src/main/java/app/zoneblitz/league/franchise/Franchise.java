package app.zoneblitz.league.franchise;

import app.zoneblitz.league.geography.City;

public record Franchise(
    long id, String name, City city, String primaryColor, String secondaryColor) {}
