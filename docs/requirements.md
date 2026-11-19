# Requirements

Every test title in `tests/` names one of these ids, so an assertion can always be traced back to a requirement. Phase 0 covers the requirements below; later phases add product requirements from the ticket source.

## Auth

- **REQ-AUTH-01** A valid email and password signs the user in and lands on the product list.
- **REQ-AUTH-02** A wrong password shows an error and does not sign the user in.
- **REQ-AUTH-03** An empty password is rejected.
- **REQ-AUTH-04** Cart and order API calls without a valid token return 401.

## Catalog

- **REQ-CAT-01** The product list shows all six seeded products with name, price, and stock state.
- **REQ-CAT-02** Searching by product name filters the list to matching products.
- **REQ-CAT-03** Search is case-insensitive.
- **REQ-CAT-04** An unknown product id returns 404.
- **REQ-CAT-05** A search with no matches shows an empty state and does not error.

## Cart

- **REQ-CART-01** Adding a product shows a toast and the item appears in the cart.
- **REQ-CART-02** Changing quantity updates subtotal, tax (8%), and total.
- **REQ-CART-03** Removing the last item empties the cart and resets totals to $0.00.
- **REQ-CART-04** A quantity of zero or below is rejected and the cart is unchanged.
- **REQ-CART-05** An out-of-stock product cannot be added.
- **REQ-CART-06** A signed-in user's cart survives a page reload.

## Checkout

- **REQ-CHK-01** The order total equals subtotal plus 8% tax, rounded to cents.
- **REQ-CHK-02** `SAVE10` takes 10% off the subtotal.
- **REQ-CHK-03** Checkout with an empty cart returns 400 and creates no order.
- **REQ-CHK-04** A placed order appears in the order history with the same total.
- **REQ-CHK-05** The discount is capped at the subtotal, so a total never goes below zero.

## Orders

- **REQ-ORD-01** Order history lists the newest order first.
