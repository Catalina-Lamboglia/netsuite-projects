# Automated Cross-Connect Provisioning (SuiteScript 2.1 User Event)

Automatically generates **Data Center Work Orders** (`customrecord_datacenter_work_order`) and dispatches clickable deep-link alerts to the Network Operations Center (NOC) queue when a Sales Order containing Interconnection items transitions to `Pending Fulfillment`.

---

## Structure

```text
cross-connect-provisioning/
├── README.md
└── src/
    ├── lib/
    │   └── provisioning_util.js          # Custom record builder, sublist stamper & N/url email dispatcher
    └── userevent/
        └── provision_cross_connect_ue.js # Sales Order afterSubmit entry point
```

---

## Execution Flow (`afterSubmit`)

1. **State Transition Guard:** Compares `oldRecord` vs. `newRecord` `orderstatus` so provisioning triggers strictly on the transition into `Pending Fulfillment` (`B`), ignoring subsequent administrative edits.
2. **Line Filtering & Idempotency:** Scans the `item` sublist for lines matching `custscript_interconnect_class_id` that do not already have a stamped Work Order (`custcol_provisioned_wo_ref`).
3. **Provisioning & Alerting:** Creates one Work Order per qualifying line, resolves its environment-specific URL via `url.resolveRecord()`, and emails the NOC queue.
4. **Back-Reference Stamp:** Loads the Sales Order in Standard Mode (`isDynamic: false`) via `stampSublistFieldValues()` to write the generated Work Order IDs back onto the source lines without re-triggering sourcing.

---

## NetSuite Configuration

### Custom Record: Data Center Work Order (`customrecord_datacenter_work_order`)

| Field ID | Type | Source |
| :--- | :--- | :--- |
| `custrecord_wo_sales_order` | List/Record (`Transaction`) | Parent Sales Order ID |
| `custrecord_wo_customer` | List/Record (`Customer`) | Sales Order `entity` |
| `custrecord_wo_facility` | List/Record (`Location`) | Sales Order `location` |
| `custrecord_wo_service_item` | List/Record (`Item`) | Line `item` |
| `custrecord_wo_a_side_port` | Free-Form Text | Line `custcol_a_side_rack_port` |
| `custrecord_wo_z_side_port` | Free-Form Text | Line `custcol_z_side_rack_port` |
| `custrecord_wo_media_type` | List/Record (`Fiber Media`) | Line `custcol_fiber_media_type` |
| `custrecord_wo_sla_due_date` | Date | Line `custcol_provisioning_sla_date` |

### Custom Sales Order Line Columns (`item` sublist)
* `custcol_a_side_rack_port` (Free-Form Text)
* `custcol_z_side_rack_port` (Free-Form Text)
* `custcol_fiber_media_type` (List/Record)
* `custcol_provisioning_sla_date` (Date)
* `custcol_provisioned_wo_ref` (List/Record: `Data Center Work Order`)

### Script Parameters

| Parameter ID | Type | Required | Purpose |
| :--- | :--- | :--- | :--- |
| `custscript_interconnect_class_id` | List/Record (`Class`) | **Yes** | Identifies Interconnection/Cross-Connect line items. |
| `custscript_noc_email_author` | List/Record (`Employee`) | No | Sender ID for NOC dispatch emails. |
| `custscript_noc_queue_email` | Email Address | No | Target NOC ticketing queue address. |
