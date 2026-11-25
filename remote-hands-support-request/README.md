# Remote Hands Dispatch Sync (SuiteScript 2.1 RESTlet)

Ingests real-time "Remote Hands" service requests (e.g., server reboots, physical hardware checks) from an external customer portal and creates NetSuite **Support Cases** (`supportcase`) for on-site technician dispatch and downstream time/usage billing.

---

## Structure

```text
remote-hands-dispatch-restlet/
├── README.md
└── src/
    ├── lib/
    │   └── restlet_request_validator.js      # Generic JSON payload key assertions & external ID deduplication
    └── restlet/
        └── create_remote_hands_ticket_rl.js  # POST handler creating Support Cases
```

---

## API Contract (`POST`)

### Request Payload
```json
{
  "externalTicketId": "RH-90421",
  "customerId": 1042,
  "facilityId": 5,
  "rackCabinetId": "CAGE-14-RACK-B4",
  "actionRequested": "Power-cycle / reboot physical server in slot U12",
  "instructions": "Verify amber PSU LED clears after hard reboot.",
  "estimatedTechHours": 1.0
}
```
*Mandatory keys:* `externalTicketId`, `customerId`, `facilityId`, `rackCabinetId`, `actionRequested`.

### Responses
* **`201 Created`:** `{ "success": true, "status": 201, "internalId": "58219", "externalTicketId": "RH-90421" }`
* **`200 OK` (Idempotent Retry):** Returns existing `internalId` if `externalTicketId` already exists on a Support Case.
* **Validation Error:** Throws `N/error` (`INVALID_JSON_PAYLOAD` or `MISSING_REQUIRED_PAYLOAD_KEYS`) with `notifyOff: true`.

---

## NetSuite Configuration

### Custom CRM Fields (`supportcase`)

| Field ID | Type | Purpose |
| :--- | :--- | :--- |
| `custevent_portal_dispatch_id` | Free-Form Text | External portal ticket ID for idempotency checks. |
| `custevent_datacenter_facility` | List/Record (`Location`) | Target facility/site. |
| `custevent_rack_cabinet_id` | Free-Form Text | Cage/rack location identifier. |
| `custevent_est_technician_hours` | Decimal Number | Estimated labor hours for dispatch planning. |

### Script Parameter

| Parameter ID | Type | Required | Purpose |
| :--- | :--- | :--- | :--- |
| `custscript_portal_case_origin` | List/Record (`Case Origin`) | No | Defaults Case Origin (e.g., *Customer Portal*). |

---

## Architectural Notes
* **Idempotency:** Queries `custevent_portal_dispatch_id` before `record.create()` so webhook retries never generate duplicate tickets.
* **Alert Hygiene:** Sets `notifyOff: true` on `N/error.create()` to prevent client payload errors from triggering admin email storms.
* **Upstream/Downstream Decoupling:** Handles synchronous operational dispatch only; completed labor and metered power draw are ingested asynchronously and billed via batch Map/Reduce (`billing-map-reduce`).
