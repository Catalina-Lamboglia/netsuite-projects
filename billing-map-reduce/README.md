# Automated Metered Usage Overage Billing (SuiteScript 2.1)

## Overview
This project implements a modular **SuiteScript 2.1 Map/Reduce pipeline** designed to automate monthly overage billing for metered infrastructure, telecommunications, or SaaS usage (e.g., data center power draw in kW, bandwidth in Mbps, or API consumption). 


---

## Repository Structure

```text
billing-map-reduce/
├── README.md
└── src/
    ├── lib/
    │   ├── billing_util.js        # Overage math & consolidated Invoice builder
    │   └── map_reduce_util.js     # Reusable Map/Reduce summary parser & admin email alerts
    └── overage-billing/
        └── calc_all_overages.js   # Calculates all overage bills, has the option to target specific customers using the `custscript_target_customer` parameter
```

---

## Business Process & Architecture

1. **`getInputData` (Data Extraction):** Queries `customrecord_usage_telemetry` via `N/search` for all unprocessed records (`custrecord_ut_processed = F`) where `Metered Qty > Contracted Qty`. Supports an optional `custscript_target_customer` parameter to isolate execution to a single customer during QA testing or ad-hoc billing runs.
2. **`map` (Calculation & Grouping):** Delegates overage math to `billing_util.calculateOverage()` and emits key-value pairs keyed by **Customer Internal ID**, allowing NetSuite's shuffle phase to automatically group multiple asset overages per customer.
3. **`reduce` (Consolidated Invoicing & Idempotency):** Executes once per unique customer. Calls `billing_util.createConsolidatedInvoice()` to generate a single consolidated NetSuite Invoice containing one line item per asset/location that exceeded its threshold, then stamps source telemetry records via `record.submitFields()` to prevent duplicate billing.
4. **`summarize` (Observability & Alerting):** Delegates execution telemetry (duration, governance units consumed, invoices generated) and stage-level error aggregation to `map_reduce_util.processSummaryAndAlert()`, dispatching an automated email alert if any records fail.

---

## NetSuite Record Architecture

### Custom Record: Usage Telemetry (`customrecord_usage_telemetry`)

| Field ID | Field Type | Description |
| :--- | :--- | :--- |
| `custrecord_ut_customer` | List/Record (`Customer`) | Customer billed for the asset/service. |
| `custrecord_ut_location` | List/Record (`Location`) | Facility, site, or region where usage occurred. |
| `custrecord_ut_asset_id` | Free-Form Text | Identifier for the metered asset (e.g., Cabinet ID, Circuit ID). |
| `custrecord_ut_contracted_qty` | Decimal Number | Monthly usage threshold included in base contract. |
| `custrecord_ut_metered_qty` | Decimal Number | Actual metered usage recorded for the billing period. |
| `custrecord_ut_overage_rate` | Currency | Per-unit rate charged for usage exceeding `contracted_qty`. |
| `custrecord_ut_billing_period` | Free-Form Text | Billing cycle identifier (e.g., `2026-11`). |
| `custrecord_ut_processed` | Check Box | Idempotency flag; set to `T` once invoiced. |
| `custrecord_ut_invoice_ref` | List/Record (`Transaction`) | Audit link to the generated NetSuite Invoice. |

---

## Script Deployment & Parameters

Deploy `calc_all_overages.js` as a **Map/Reduce Script** (`@NApiVersion 2.1`) and configure the following Script Parameters on the **Script Deployment** record:

| Parameter ID | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `custscript_overage_item_id` | List/Record (`Item`) | **Yes** | Non-inventory/service item added to generated overage invoices. |
| `custscript_target_customer` | List/Record (`Customer`) | No | Optional filter to run billing for a single customer; leave blank to process all customers. |
| `custscript_billing_email_author` | List/Record (`Employee`) | No | Internal sender ID for automated exception alerts. |
| `custscript_billing_team_email` | Email Address | No | Distribution list notified if any stage encounters an error. |

---

## Key Engineering Highlights

* **Modular DRY Design:** Separating `billing_util.js` and `map_reduce_util.js` allows future billing workflows (e.g., one-time service fees or SLA credits) to reuse the same invoice-generation and error-alerting pipelines.
* **Governance Efficiency:** Uses `record.submitFields()` (2 governance units) rather than `record.load()` + `record.save()` (20 governance units) when updating telemetry records in the `reduce` stage, cutting post-processing governance consumption by 90%.
* **Dynamic Mode Invoicing:** Creates invoices with `isDynamic: true` so native NetSuite tax schedules, accounting periods, and line-level calculations evaluate accurately upon commit.
* **Built-In Idempotency:** Filtering by `custrecord_ut_processed = F` and stamping `custrecord_ut_invoice_ref` guarantees that re-running the script after a partial failure will never double-bill a customer.
