# Assertion Standard

Version 1.0.0 - 2026-11-19. Applies to every test merged from Phase 1 onward. The Reviewer Agent in Phase 4 checks assertion quality against this document, so it has to be specific enough to decide a case without a human.

## The rule

An assertion must prove the behaviour the requirement asks for, from the outside, with a value a reviewer could compute by hand.

Four tests:

1. **Traceable.** The test title names the requirement id, and the requirement can be read in `docs/requirements.md` without interpretation.
2. **Specific.** It asserts an exact value or state. `toBeVisible` alone proves a render, not a behaviour.
3. **Outcome, not implementation.** It asserts what the user gets, not which CSS class, internal function, or DOM shape produced it.
4. **Stable.** It waits on the application through web-first assertions, never on a clock.

## Good and bad examples

**Bad - truthiness instead of value**

```ts
expect(await page.getByTestId('cart-total').innerText()).toBeTruthy();
```

Any non-empty string passes, including `$0.00`, `NaN`, or an error banner.

**Good - exact value**

```ts
await expect(page.getByTestId('cart-total')).toHaveText('$192.24');
```

**Bad - implementation detail**

```ts
await expect(page.locator('.cart-row.selected')).toHaveCount(1);
```

The class is a styling decision; a redesign fails the test without any behaviour changing.

**Good - observable state**

```ts
await expect(page.getByTestId('cart-row')).toHaveCount(1);
```

**Bad - sleeping**

```ts
await page.click('[data-testid=add-to-cart]');
await page.waitForTimeout(2000);
expect(await page.getByTestId('toast').isVisible()).toBe(true);
```

The sleep hides a race and slows every run; under load the test still flakes.

**Good - waiting for the outcome**

```ts
await page.getByTestId('add-to-cart').click();
await expect(page.getByTestId('toast')).toHaveText('Added Nomad Mug');
```

**Bad - a check the requirement never asked for**

```ts
// REQ-CHK-01 says total = subtotal + 8% tax
expect(order.id).toMatch(/^ORD-\d{4}$/);
```

It may pass forever while the totals are wrong, and it adds a maintenance cost nobody asked for.

## Review questions

A reviewer answers these before merging, in order. Any "no" is a change request, not a comment:

1. Would this fail if the behaviour were broken? Name the break it catches.
2. Is the expected value computed from the requirement, not copied from the app's output?
3. Does it wait on the app rather than on time?
4. Does it add anything the requirement did not ask for?
5. Would a failure message tell the next person which requirement broke?

## What a weak suggestion looks like

These are the shapes an AI proposal falls into most often, and each one is a rejection:

- A tautology: reading a value from the page and asserting it equals itself.
- A softer assertion swapped in to make a failing test pass (`toHaveCount(1)` replaced by `not.toHaveCount(0)`).
- A retry or `waitForTimeout` added instead of a fix.
- A test that asserts three requirements at once, so a failure names none of them.
- A locator based on visible copy that a copy change will break.
