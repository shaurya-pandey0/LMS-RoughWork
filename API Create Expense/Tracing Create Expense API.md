### File 1: `frontend/src/ExpensesPage.jsx`

The create flow begins in [`ExpensesPage.jsx`](frontend/src/ExpensesPage.jsx#L139).

```js
139: const handleSubmit = async () => {
140:   const value = parseFloat(amount);
141:   if (!value || value <= 0) {
142:     setAmountError('Enter an amount greater than 0');
143:     document.getElementById('entry-amount')?.focus();
144:     return;
145:   }
```

React does only a basic user-experience check: â€œis this a positive number?â€  
This is not trusted business validationâ€”the backend validates again.

```js
148: const iso = date || todayIso();
149: const payload = { date: iso, category, amount: value };
```

It builds the request payload, for example:

```json
{
  "date": "2026-07-27",
  "category": "Food",
  "amount": 250
}
```

```js
158: } else {
159:   const created = await expenseApi.create(payload);
160:   const row = {
161:     id: created.id,
162:     isoDate: created.date,
163:     date: isoToShort(created.date),
164:     category: created.category,
165:     amount: Number(created.amount)
166:   };
167:   setTxns((prev) => [row, ...prev]);
168: }
```

`expenseApi.create(payload)` is the handoff to the HTTP layer. It pauses until Spring Boot replies.

On success, the server returns the saved recordâ€”including its MySQL-generated `id`. React converts it into the shape used by the screen and prepends it to `txns`, causing the expense table/chart to re-render without another fetch.

```js
163: setAmount('');
164: setDate('');
165: setCategory(defaultCategory());
166: } catch (err) {
167:   setPageError(err.message || 'Could not save that expense');
168: }
```

Finally, it clears the form. If Spring returns an errorâ€”such as an invalid categoryâ€”React displays that backend message.

Type **next** for File 2: the exact `expenseApi.create()` function that turns this payload into the HTTP `POST` request.

---

### File 2: [`frontend/src/lib/api.js`](frontend/src/lib/api.js#L104)

- At [line 106](frontend/src/lib/api.js#L106), `expenseApi.create(data)` selects the endpoint: `POST /expenses`.

- At [lines 79â€“83](frontend/src/lib/api.js#L79), that call goes through the shared `api.post` helper.

- At [lines 34â€“50](frontend/src/lib/api.js#L34), the shared request function:
  - builds the URL using the base address;
  - serializes the expense payload into JSON;
  - sets JSON request headers;
  - reads the logged-in userâ€™s JWT from browser storage;
  - attaches it as `Authorization: Bearer <token>`;
  - sends the actual browser HTTP request to Spring Boot at `http://localhost:8080/api/expenses` by default.

- At [lines 59â€“76](frontend/src/lib/api.js#L59), it parses Spring Bootâ€™s response. A non-2xx response becomes an `ApiError`; a successful response returns the saved expense JSON to `ExpensesPage`.

Next is the backend endpoint: the Spring Boot controller that receives `POST /api/expenses`.

---

### File 3: [`backend/.../controller/ExpenseController.java`](backend/src/main/java/com/lifetrack/controller/ExpenseController.java#L22)

- [Line 23](backend/src/main/java/com/lifetrack/controller/ExpenseController.java#L23) maps this controller to `/api/expenses`.

- [Lines 44â€“45](backend/src/main/java/com/lifetrack/controller/ExpenseController.java#L44) match the incoming `POST /api/expenses` and deserialize the JSON body into an `ExpenseRequest`.

- The `@Valid` at [line 45](backend/src/main/java/com/lifetrack/controller/ExpenseController.java#L45) triggers DTO-level validation before any database work. If required fields or basic constraints fail, Spring returns `400 Bad Request` immediately.

- [Line 47](backend/src/main/java/com/lifetrack/controller/ExpenseController.java#L47) gets the user ID from the authenticated JWT sessionâ€”not from browser-provided request dataâ€”and passes both that ID and the validated request to `ExpenseService`.

- [Line 46](backend/src/main/java/com/lifetrack/controller/ExpenseController.java#L46) converts the saved entity into a response DTO.

- [Line 48](backend/src/main/java/com/lifetrack/controller/ExpenseController.java#L48) returns `201 Created` and that safe response DTO to the browser.

Next file: the request/response DTO definitions, which define exactly what Spring accepts and returns.

---

They are not directly â€œcalling each otherâ€ like two JavaScript functions. They communicate through an ordinary **HTTP request over localhost**.

The exact bridge is:

1. React reaches [`api.js` line 45](frontend/src/lib/api.js#L45).

2. The browser runs `fetch(...)`, sending an HTTP request to the URL built from:

   - [`api.js` line 8](frontend/src/lib/api.js#L8): frontendâ€™s backend base URL, normally `http://localhost:8080/api`
   - [`api.js` line 106](frontend/src/lib/api.js#L106): adds `/expenses`

   So the real request is:

   ```text
   POST http://localhost:8080/api/expenses
   ```

3. The browser includes:
   - JSON request body, assembled at [`api.js` line 48](frontend/src/lib/api.js#L48)
   - JWT login token in the `Authorization` header at [`api.js` lines 38â€“41](frontend/src/lib/api.js#L38)

4. Spring Boot is running separately as a web server on port `8080`. It receives that URL. Spring examines the path `/api/expenses`, finds the matching mapping at [`ExpenseController.java` line 23](backend/src/main/java/com/lifetrack/controller/ExpenseController.java#L23), and runs the `POST` method at [line 44](backend/src/main/java/com/lifetrack/controller/ExpenseController.java#L44).

Then the response travels back through that same HTTP connection:

```text
React browser
  â†’ HTTP POST localhost:8080/api/expenses
  â†’ Spring Boot controller
  â†’ response JSON + 201 Created
  â†’ browser fetch receives it
  â†’ React updates state and redraws UI
```

So the â€œintersectionâ€ is simply the URL contract: **React sends `POST /api/expenses`; Springâ€™s controller declares it handles `POST /api/expenses`.**

---

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ React: ExpensesPage.jsx                                      â”‚
â”‚ User enters date, category, amount, then presses Save        â”‚
â”‚                                                              â”‚
â”‚ handleSubmit() builds: { date, category, amount }            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                             â”‚
                             â”‚ expenseApi.create(payload)
                             â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ React: lib/api.js                                            â”‚
â”‚                                                              â”‚
â”‚ API base: http://localhost:8080/api                          â”‚
â”‚ Endpoint: /expenses                                          â”‚
â”‚ Method: POST                                                 â”‚
â”‚                                                              â”‚
â”‚ Adds JSON body + Authorization: Bearer <JWT>                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                             â”‚
                             â”‚ HTTP request over localhost
                             â”‚
                             â”‚ POST http://localhost:8080/api/expenses
                             â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Spring Boot server â€” port 8080                               â”‚
â”‚                                                              â”‚
â”‚ Receives browser request                                     â”‚
â”‚ Reads and verifies JWT                                       â”‚
â”‚ Identifies the logged-in user                                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                             â”‚
                             â”‚ URL + HTTP method match
                             â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ ExpenseController.java                                       â”‚
â”‚                                                              â”‚
â”‚ @RequestMapping("/api/expenses")                             â”‚
â”‚ @PostMapping                                                 â”‚
â”‚                                                              â”‚
â”‚ JSON â†’ ExpenseRequest                                        â”‚
â”‚ @Valid performs basic request validation                     â”‚
â”‚ Current user ID comes from authenticated JWT                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                             â”‚
                             â”‚ expenseService.create(userId, request)
                             â–¼
                   Next: DTO â†’ service â†’ repository â†’ MySQL
```

---


> Yes. From here it is a normal CRUD flow: controller â†’ service â†’ JPA > repository â†’ MySQL â†’ same chain backwards.

The request reaches MySQL at:

- [`ExpenseService.java` line 34](backend/src/main/java/com/lifetrack/service/ExpenseService.java#L34) starts the create operation.
- [Lines 35â€“37](backend/src/main/java/com/lifetrack/service/ExpenseService.java#L35) create the entity, attach the authenticated user ID, validate the category, and copy date/category/amount into it.
- [`ExpenseService.java` line 38](backend/src/main/java/com/lifetrack/service/ExpenseService.java#L38) calls `expenseRepository.save(expense)`. This is the point at which Spring Data JPA/Hibernate generates and executes the SQL `INSERT`.
- [`Expense.java` lines 14â€“18](backend/src/main/java/com/lifetrack/entity/Expense.java#L14) map the Java entity to the MySQL `expenses` table.
- [`Expense.java` lines 21â€“23](backend/src/main/java/com/lifetrack/entity/Expense.java#L21) tell MySQL to generate the ID automatically.

There is no handwritten `INSERT INTO expenses ...` query in this app. JPA generates it from the entity mapping when `save(...)` runs.

The result returns like this:

```text
MySQL inserts the row and generates its ID
  â†“
expenseRepository.save(expense) returns the saved Expense entity
  â†“
ExpenseService.create(...) returns it
  â†“
ExpenseController converts it into ExpenseResponse
  â†“
Spring serializes it into JSON and sends HTTP 201
  â†“
api.js parses JSON
  â†“
ExpensesPage adds it to React state and the UI redraws
```

Exact return lines:

- [`ExpenseService.java` line 38](backend/src/main/java/com/lifetrack/service/ExpenseService.java#L38): saved entity returns from JPA/MySQL.
- [`ExpenseController.java` lines 46â€“48](backend/src/main/java/com/lifetrack/controller/ExpenseController.java#L46): converts it into a response and sends `201 Created`.
- [`ExpenseDtos.java` lines 23â€“30](backend/src/main/java/com/lifetrack/dto/ExpenseDtos.java#L23): chooses exactly which entity fields become response JSON.
- [`api.js` lines 59â€“76](frontend/src/lib/api.js#L59): browser parses that JSON and returns it to the page.
- [`ExpensesPage.jsx` lines 159â€“161](frontend/src/ExpensesPage.jsx#L159): React receives the saved record and adds it to `txns`, which redraws the UI.


---

> Final destination is the UI

Yesâ€”the final destination is the UI.

After Spring returns `201 Created`:

```text
Spring response JSON
  â†’ api.js parses it
  â†’ ExpensesPage receives `created`
  â†’ setTxns(...) updates React state
  â†’ React automatically re-renders affected UI
```

The exact UI-update point is [`ExpensesPage.jsx` line 161](frontend/src/ExpensesPage.jsx#L161).

That line inserts the newly returned expense into the `txns` state list. Everything in that page that displays `txns`â€”the expense rows, total, category breakdown, budget percentage, and chartâ€”recalculates during Reactâ€™s re-render and appears on screen.

So MySQL is never accessed by the UI directly. It always returns through Spring Boot, then `api.js`, then React state, then the rendered page.
