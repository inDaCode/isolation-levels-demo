# ADR-004: Three Terminals Instead of Two

## Status

Accepted

## Context

Most isolation level demos use 2 sessions. Need to determine how many terminals we need.

## Requirements Analysis

- Dirty read, non-repeatable read, phantom read — 2 terminals sufficient
- Lost update, write skew — 2 terminals sufficient
- Basic deadlock — 2 terminals sufficient
- Chain deadlock (A waits for B, B waits for C, C waits for A) — requires 3
- Lock queue visualization (holder, waiter, next waiter) — requires 3

## Decision

Three terminals. This is the minimum to demonstrate all scenarios including chain deadlock and lock queue.

## Consequences

**Positive:**

- Can demonstrate complex scenarios missing from typical demos
- Differentiates from other educational tools

**Negative:**

- More UI elements
- More complex layout
- 3 PG connections per user instead of 2
