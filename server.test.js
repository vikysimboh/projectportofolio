"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const { createAppServer } = require("./server");
const { createPool, closeAllPools } = require("./db");

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Kasirku-Admin-Tes-2026";
const CASHIER_USERNAME = "kasir-tes";
const CASHIER_PASSWORD = "Kasirku-Kasir-Tes-2026";
const TEST_EMOJI = "\u{1F36B}";

function makeDbName() {
  return `grace_shop_test_${process.pid}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

async function createTestDatabase(dbName) {
  const adminPool = createPool();
  try {
    await adminPool.query(`CREATE DATABASE \`${dbName}\``);
  } finally {
    await adminPool.end();
  }
}

async function dropTestDatabase(dbName) {
  const adminPool = createPool();
  try {
    await adminPool.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  } finally {
    await adminPool.end();
  }
}

function makeWorld() {
  const world = {
    dbName: "",
    server: null,
    origin: "",
    authCookie: "",
    async start() {
      world.dbName = makeDbName();
      await createTestDatabase(world.dbName);
      world.server = createAppServer({ dbName: world.dbName });
      await world.server.ready;
      await new Promise((resolve) => world.server.listen(0, "127.0.0.1", resolve));
      world.origin = `http://127.0.0.1:${world.server.address().port}`;
    },
    async stopServer() {
      if (world.server && world.server.listening) {
        await new Promise((resolve, reject) => {
          world.server.close((error) => (error ? reject(error) : resolve()));
        });
      }
      await closeAllPools();
    },
    async stop() {
      await world.stopServer();
      if (world.dbName) {
        await dropTestDatabase(world.dbName);
        await closeAllPools();
      }
    },
    async request(url, options = {}) {
      return world.requestAs(world.authCookie, url, options);
    },
    async requestAs(cookie, url, options = {}) {
      const response = await fetch(`${world.origin}${url}`, {
        ...options,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(options.headers || {}),
        },
      });
      return { status: response.status, body: await response.json() };
    },
    async setupAdmin() {
      const response = await fetch(`${world.origin}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
      });
      const body = await response.json();
      assert.equal(response.status, 201, JSON.stringify(body));
      world.authCookie = response.headers.get("set-cookie").split(";")[0];
      return body;
    },
    async login(username, password) {
      const response = await fetch(`${world.origin}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      return { cookie: response.headers.get("set-cookie").split(";")[0], body };
    },
  };
  return world;
}

test("API persists products and protects stock during concurrent checkouts", async (t) => {
  const world = makeWorld();
  await world.start();
  t.after(async () => { await world.stop(); });
  await world.setupAdmin();
  const health = await world.request("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.status, "ok");
  const homeResponse = await fetch(`${world.origin}/`, { headers: { Cookie: world.authCookie } });
  assert.equal(homeResponse.status, 200);
  assert.match(await homeResponse.text(), /src="app.js"/);
  const serverJs = await fetch(`${world.origin}/server.js`, { headers: { Cookie: world.authCookie } });
  assert.equal(serverJs.status, 404);
  const storeJson = await fetch(`${world.origin}/data/store.json`, { headers: { Cookie: world.authCookie } });
  assert.equal(storeJson.status, 404);
  const state = await world.request("/api/state");
  assert.equal(state.status, 200);
  assert.equal(state.body.products.length, 9);
  const created = await world.request("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Produk Tes", category: "Snack", emoji: TEST_EMOJI, price: 5000, stock: 4 }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.product.name, "Produk Tes");
  const afterCreate = await world.request("/api/state");
  assert.equal(afterCreate.body.products[0].name, "Produk Tes");
  const updated = await world.request(`/api/products/${created.body.product.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Produk Tes", category: "Snack", emoji: TEST_EMOJI, price: 6000, stock: 4 }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.product.price, 6000);
  const deleted = await world.request(`/api/products/${created.body.product.id}`, { method: "DELETE" });
  assert.equal(deleted.status, 200);
  const afterDelete = await world.request("/api/state");
  assert.equal(afterDelete.body.products.find((product) => product.id === created.body.product.id), undefined);
  const checkout = (qty) => world.request("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer: "Pembeli Tes", payment: "QRIS", items: [{ productId: "PRD-005", qty }] }),
  });
  const results = await Promise.all([checkout(2), checkout(2)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  const success = results.find((result) => result.status === 201);
  assert.equal(success.body.transaction.total, 24000);
  const afterCheckout = await world.request("/api/state");
  assert.equal(afterCheckout.body.products.find((product) => product.id === "PRD-005").stock, 1);
  const cancelled = await world.request(`/api/transactions/${success.body.transaction.id}/cancel`, { method: "POST" });
  assert.equal(cancelled.status, 200);
  const afterCancel = await world.request("/api/state");
  assert.equal(afterCancel.body.products.find((product) => product.id === "PRD-005").stock, 3);
  const cancelledAgain = await world.request(`/api/transactions/${success.body.transaction.id}/cancel`, { method: "POST" });
  assert.equal(cancelledAgain.status, 409);
  await world.stopServer();
  world.server = createAppServer({ dbName: world.dbName });
  await world.server.ready;
  await new Promise((resolve) => world.server.listen(0, "127.0.0.1", resolve));
  world.origin = `http://127.0.0.1:${world.server.address().port}`;
  const adminLogin = await world.login(ADMIN_USERNAME, ADMIN_PASSWORD);
  world.authCookie = adminLogin.cookie;
  const reopened = await world.request("/api/state");
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.products.length, 9);
});

test("Admin login protects pages and APIs, rejects wrong passwords, and logout invalidates the session", async (t) => {
  const world = makeWorld();
  await world.start();
  t.after(async () => { await world.stop(); });
  const anonymous = await fetch(`${world.origin}/`, { redirect: "manual" });
  assert.equal(anonymous.status, 302);
  assert.equal(anonymous.headers.get("location"), "/setup");
  await world.setupAdmin();
  const homeResponse = await fetch(`${world.origin}/`, { headers: { Cookie: world.authCookie } });
  assert.equal(homeResponse.status, 200);
  const state = await world.request("/api/state");
  assert.equal(state.status, 200);
  assert.equal(state.body.products.length, 9);
  const loginPage = await fetch(`${world.origin}/login`, { headers: { Cookie: world.authCookie }, redirect: "manual" });
  assert.equal(loginPage.status, 302);
  assert.equal(loginPage.headers.get("location"), "/");
  const wrongPassword = await world.requestAs("", "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: "kata-sandi-salah" }),
  });
  assert.equal(wrongPassword.status, 401);
  const setupAgain = await world.request("/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  assert.equal(setupAgain.status, 409);
  const logout = await world.request("/logout", {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  assert.equal(logout.status, 200);
  const afterLogout = await world.request("/api/state");
  assert.equal(afterLogout.status, 401);
  const afterLogoutPage = await fetch(`${world.origin}/`, { redirect: "manual" });
  assert.equal(afterLogoutPage.status, 302);
  assert.equal(afterLogoutPage.headers.get("location"), "/login");
});

test("Cashier role is limited to checkout and state, admin-only APIs return 403", async (t) => {
  const world = makeWorld();
  await world.start();
  t.after(async () => { await world.stop(); });
  await world.setupAdmin();
  const createdCashier = await world.request("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CASHIER_USERNAME, password: CASHIER_PASSWORD, role: "kasir" }),
  });
  assert.equal(createdCashier.status, 201);
  assert.equal(createdCashier.body.user.username, CASHIER_USERNAME);
  assert.equal(createdCashier.body.user.role, "kasir");
  const users = await world.request("/api/users");
  assert.equal(users.status, 200);
  assert.equal(users.body.users.find((user) => user.username === CASHIER_USERNAME).role, "kasir");
  const report = await world.request("/api/report");
  assert.equal(report.status, 200);
  assert.equal(report.body.period, 30);
  const cashierLogin = await world.login(CASHIER_USERNAME, CASHIER_PASSWORD);
  assert.equal(cashierLogin.body.role, "kasir");
  assert.equal(cashierLogin.body.username, CASHIER_USERNAME);
  const cashierState = await world.requestAs(cashierLogin.cookie, "/api/state");
  assert.equal(cashierState.status, 200);
  assert.equal(cashierState.body.user.role, "kasir");
  const cashierProducts = await world.requestAs(cashierLogin.cookie, "/api/products");
  assert.equal(cashierProducts.status, 200);
  assert.equal(cashierProducts.body.products.length, 9);
  const cashierCreate = await world.requestAs(cashierLogin.cookie, "/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Produk Kasir", category: "Snack", emoji: TEST_EMOJI, price: 1000, stock: 1 }),
  });
  assert.equal(cashierCreate.status, 403);
  const cashierReport = await world.requestAs(cashierLogin.cookie, "/api/report");
  assert.equal(cashierReport.status, 403);
  const cashierUsers = await world.requestAs(cashierLogin.cookie, "/api/users");
  assert.equal(cashierUsers.status, 403);
  const cashierCreateUser = await world.requestAs(cashierLogin.cookie, "/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "kasir-lain", password: "Kasirku-Kasir-Tes-2026", role: "kasir" }),
  });
  assert.equal(cashierCreateUser.status, 403);
  const cashierCheckout = await world.requestAs(cashierLogin.cookie, "/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer: "Pembeli Kasir", payment: "QRIS", items: [{ productId: "PRD-005", qty: 1 }] }),
  });
  assert.equal(cashierCheckout.status, 201);
  assert.equal(cashierCheckout.body.transaction.total, 12000);
  const afterCashierCheckout = await world.request("/api/state");
  assert.equal(afterCashierCheckout.body.products.find((product) => product.id === "PRD-005").stock, 2);
  const cashierCancel = await world.requestAs(cashierLogin.cookie, `/api/transactions/${cashierCheckout.body.transaction.id}/cancel`, { method: "POST" });
  assert.equal(cashierCancel.status, 403);
  const adminCancel = await world.request(`/api/transactions/${cashierCheckout.body.transaction.id}/cancel`, { method: "POST" });
  assert.equal(adminCancel.status, 200);
  const afterAdminCancel = await world.request("/api/state");
  assert.equal(afterAdminCancel.body.products.find((product) => product.id === "PRD-005").stock, 3);
  const adminCreate = await world.request("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Produk Admin", category: "Snack", emoji: TEST_EMOJI, price: 1000, stock: 1 }),
  });
  assert.equal(adminCreate.status, 201);
  assert.equal(adminCreate.body.product.name, "Produk Admin");
  const anonymousReport = await world.requestAs("", "/api/report");
  assert.equal(anonymousReport.status, 401);
});
