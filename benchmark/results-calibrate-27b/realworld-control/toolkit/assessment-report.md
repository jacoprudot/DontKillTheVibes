# Assessment Report: realworld-control

- **Repository**: realworld-control
- **Date**: 2026-10-04T23:30:47.128Z
- **Model**: qwen2.5-coder:7b
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: D
- **Critical Findings**: —
- **Total Findings**: 2
- **By Severity**: high 2
- **Estimated Total Effort**: 1×M, 1×L
- **Top 3 Priorities**:
  - `structure-high-coupling-1` — Controller directly accesses repository bypassing service layer (high, L)
  - `structure-layer-violation-1` — Controller contains business logic that should be in service layer (high, M)

---

## Detailed Findings (by Priority)

### Priority 1: `structure-high-coupling-1`
**Module**: structure | **Severity**: high | **Effort**: L | **Confidence**: 0.9
**Location**: `src/controllers/OrderController.java:8`
**Description**: Controller directly accesses repository bypassing service layer
**Remediation**: Inject OrderService instead and delegate to service layer
**Evidence**: benchmark: High coupling detected
```
private OrderRepository orderRepository;
```
**Depends On**: None | **Blocks**: None

### Priority 2: `structure-layer-violation-1`
**Module**: structure | **Severity**: high | **Effort**: M | **Confidence**: 0.9
**Location**: `src/controllers/OrderController.java:16`
**Description**: Controller contains business logic that should be in service layer
**Remediation**: Move tax calculation and discount application to OrderService
**Evidence**: benchmark: High coupling detected
```
order.calculateTax();
order.applyDiscounts();
```
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days
- `structure-high-coupling-1`: Inject OrderService instead and delegate to service layer (L)
- `structure-layer-violation-1`: Move tax calculation and discount application to OrderService (M)

### 60 Days
- —

### 90 Days
- —

---

## Dependencies
- —

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
