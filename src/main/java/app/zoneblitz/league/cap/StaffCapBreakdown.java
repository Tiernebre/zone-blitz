package app.zoneblitz.league.cap;

import app.zoneblitz.league.cap.StaffCapView.ContractLine;
import app.zoneblitz.league.cap.StaffCapView.DeadCapLine;
import app.zoneblitz.league.cap.StaffCapView.OfferLine;
import java.util.List;

record StaffCapBreakdown(
    long budgetCents,
    List<ContractLine> contracts,
    List<OfferLine> offers,
    List<DeadCapLine> deadCap) {}
