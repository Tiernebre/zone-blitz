package app.zoneblitz.league;

public record Franchise(
    long id, String name, City city, String primaryColor, String secondaryColor) {}
