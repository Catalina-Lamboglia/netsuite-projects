# Real-World NetSuite SuiteScript 2.1 Portfolio

Modular **SuiteScript 2.1** implementations demonstrating core enterprise NetSuite tasks

## Projects

* **`billing-map-reduce/`** *(Map/Reduce Script)* — Aggregates monthly metered usage telemetry (e.g., power draw in kW), calculates threshold overages, generates consolidated customer Invoices, and reports stage errors.
* **`cross-connect-provisioning/`** *(User Event Script)* — Listens for Sales Orders transitioning to `Pending Fulfillment`, generates Data Center Work Orders for Interconnection lines, stamps back-references, and emails clickable deep links to the NOC queue.
* **`remote-hands-support-request/`** *(RESTlet)* — Exposes a `POST` endpoint for an external customer portal to ingest real-time technician dispatch requests into NetSuite Support Cases with JSON validation and external-ID idempotency.


## Running Unit Tests

```bash
npm install
npm test
```