// Shared demo fixture - used by the landing page's paste/sample flow and by
// the embedded live-demo preview so both show the exact same data.
export const SAMPLE_LOG = `2026-06-29T09:14:00.100Z DEBUG [wrk01] HTTP_Listener_config http.listener.01 SelectorRunner - LISTENER
GET /api/orders/ORD-9901/items HTTP/1.1
Accept: application/json
X-Correlation-Id: a1b2c3d4-0001-0001-0001-000000000001
X-Forwarded-Proto: https
X-Forwarded-Host: x-acme-orders-api.cloudhub.io
Host: x-acme-orders-api.internal.svc

2026-06-29T09:14:00.110Z INFO [wrk01] LoggerMessageProcessor event:a1b2c3d4-0001-0001-0001-000000000001 [MuleRuntime].uber.100 @abc - [Environment: prod] [Application: x-acme-orders-api] [Flow: x-get-order-items-flow] [Transaction Id: a1b2c3d4-0001-0001-0001-000000000001] - Before calling backend
2026-06-29T09:14:00.120Z DEBUG [wrk01] backend-config event:a1b2c3d4-0001-0001-0001-000000000001 [x-acme-orders-api].http.requester.backend-config.01 SelectorRunner - REQUESTER
GET /api/orders/ORD-9901/items HTTP/1.1
x-correlation-id: a1b2c3d4-0001-0001-0001-000000000001
Host: s-acme-backend-api.cloudhub.io:443
User-Agent: AHC/1.0

 spanId=aabbccdd

2026-06-29T09:14:00.310Z DEBUG [wrk01] backend-config event:a1b2c3d4-0001-0001-0001-000000000001 [x-acme-orders-api].http.requester.backend-config.01 SelectorRunner - REQUESTER
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 89

{"items":[{"id":"ITM-1","name":"Widget","qty":3,"price":9.99}]} spanId=aabbccdd

2026-06-29T09:14:01.000Z DEBUG [wrk01] HTTP_Listener_config http.listener.01 SelectorRunner - LISTENER
POST /api/orders HTTP/1.1
Content-Type: application/json
X-Correlation-Id: b2c3d4e5-0002-0002-0002-000000000002
X-Forwarded-Proto: https
X-Forwarded-Host: x-acme-orders-api.cloudhub.io
Host: x-acme-orders-api.internal.svc

{"customerId":"CUST-42","items":[{"sku":"WGT-001","qty":2},{"sku":"WGT-002","qty":1}],"shippingAddress":{"line1":"123 Main St","city":"Dubai","country":"AE"}}

2026-06-29T09:14:01.010Z INFO [wrk01] LoggerMessageProcessor event:b2c3d4e5-0002-0002-0002-000000000002 [MuleRuntime].uber.101 @abc - [Environment: prod] [Application: x-acme-orders-api] [Flow: x-create-order-flow] [Transaction Id: b2c3d4e5-0002-0002-0002-000000000002] - Creating new order
2026-06-29T09:14:01.020Z DEBUG [wrk01] backend-config event:b2c3d4e5-0002-0002-0002-000000000002 [x-acme-orders-api].http.requester.backend-config.02 SelectorRunner - REQUESTER
POST /api/orders HTTP/1.1
Content-Type: application/json
Transfer-Encoding: chunked
x-correlation-id: b2c3d4e5-0002-0002-0002-000000000002
Host: s-acme-backend-api.cloudhub.io:443
User-Agent: AHC/1.0

9f
{"customerId":"CUST-42","items":[{"sku":"WGT-001","qty":2},{"sku":"WGT-002","qty":1}],"shippingAddress":{"line1":"123 Main St","city":"Dubai","country":"AE"}}
 spanId=11223344

2026-06-29T09:14:01.350Z DEBUG [wrk01] backend-config event:b2c3d4e5-0002-0002-0002-000000000002 [x-acme-orders-api].http.requester.backend-config.02 SelectorRunner - REQUESTER
HTTP/1.1 201 Created
Content-Type: application/json
Content-Length: 122

 spanId=11223344

2026-06-29T09:14:01.351Z DEBUG [wrk01] backend-config event:b2c3d4e5-0002-0002-0002-000000000002 [x-acme-orders-api].http.requester.backend-config.02 SelectorRunner - REQUESTER
{"id":"ORD-9902","status":"pending","customerId":"CUST-42","totalAmount":59.97,"currency":"USD"} spanId=11223344

2026-06-29T09:14:01.400Z DEBUG [wrk01] HTTP_Listener_config event:b2c3d4e5-0002-0002-0002-000000000002 [MuleRuntime].uber.101 @abc - [x-acme-orders-api].get:\\api\\orders:x-acme-orders-api-config.CPU_INTENSIVE @def SelectorRunner - LISTENER
HTTP/1.1 201 Created
Content-Type: application/json
Content-Length: 122

{"id":"ORD-9902","status":"pending","customerId":"CUST-42","totalAmount":59.97,"currency":"USD"} spanId=11223344

2026-06-29T09:14:02.000Z DEBUG [wrk01] HTTP_Listener_config http.listener.01 SelectorRunner - LISTENER
DELETE /api/orders/ORD-8800 HTTP/1.1
Accept: application/json
X-Correlation-Id: c3d4e5f6-0003-0003-0003-000000000003
X-Forwarded-Proto: https
X-Forwarded-Host: x-acme-orders-api.cloudhub.io

2026-06-29T09:14:02.120Z DEBUG [wrk01] backend-config event:c3d4e5f6-0003-0003-0003-000000000003 [x-acme-orders-api].http.requester.backend-config.03 SelectorRunner - REQUESTER
DELETE /api/orders/ORD-8800 HTTP/1.1
x-correlation-id: c3d4e5f6-0003-0003-0003-000000000003
Host: s-acme-backend-api.cloudhub.io:443

 spanId=33445566

2026-06-29T09:14:02.300Z DEBUG [wrk01] backend-config event:c3d4e5f6-0003-0003-0003-000000000003 [x-acme-orders-api].http.requester.backend-config.03 SelectorRunner - REQUESTER
HTTP/1.1 204 No Content
Content-Length: 0
 spanId=33445566

2026-06-29T09:14:03.000Z DEBUG [wrk02] HTTP_Listener_config http.listener.02 SelectorRunner - LISTENER
GET /api/payments/PAY-501/order-items HTTP/1.1
Accept: application/json
X-Correlation-Id: d4e5f6a7-0004-0004-0004-000000000004
X-Forwarded-Proto: https
X-Forwarded-Host: x-acme-payments-api.cloudhub.io
Host: x-acme-payments-api.internal.svc

2026-06-29T09:14:03.010Z INFO [wrk02] LoggerMessageProcessor event:d4e5f6a7-0004-0004-0004-000000000004 [MuleRuntime].uber.102 @abc - [Environment: prod] [Application: x-acme-payments-api] [Flow: x-lookup-order-items-flow] [Transaction Id: d4e5f6a7-0004-0004-0004-000000000004] - Fetching order items before charge
2026-06-29T09:14:03.020Z DEBUG [wrk02] backend-config event:d4e5f6a7-0004-0004-0004-000000000004 [x-acme-payments-api].http.requester.backend-config.01 SelectorRunner - REQUESTER
GET /api/orders/ORD-9903/items HTTP/1.1
x-correlation-id: d4e5f6a7-0004-0004-0004-000000000004
Host: s-acme-backend-api.cloudhub.io:443
User-Agent: AHC/1.0

 spanId=55667788

2026-06-29T09:14:03.210Z DEBUG [wrk02] backend-config event:d4e5f6a7-0004-0004-0004-000000000004 [x-acme-payments-api].http.requester.backend-config.01 SelectorRunner - REQUESTER
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 89

{"items":[{"id":"ITM-9","name":"Widget","qty":1,"price":9.99}]} spanId=55667788

2026-06-29T09:14:04.000Z DEBUG [wrk03] HTTP_Listener_config http.listener.03 SelectorRunner - LISTENER
GET /api/orders/ORD-7000/items HTTP/1.1
Accept: application/json
X-Correlation-Id: e5f6a7b8-0005-0005-0005-000000000005
X-Forwarded-Proto: https
X-Forwarded-Host: x-acme-mobile-gateway.cloudhub.io
Host: x-acme-mobile-gateway.internal.svc

2026-06-29T09:14:04.010Z INFO [wrk03] LoggerMessageProcessor event:e5f6a7b8-0005-0005-0005-000000000005 [MuleRuntime].uber.103 @abc - [Environment: prod] [Application: x-acme-mobile-gateway] [Flow: x-get-order-items-legacy-flow] [Transaction Id: e5f6a7b8-0005-0005-0005-000000000005] - Proxying to legacy order service
2026-06-29T09:14:04.020Z DEBUG [wrk03] legacy-config event:e5f6a7b8-0005-0005-0005-000000000005 [x-acme-mobile-gateway].http.requester.legacy-config.01 SelectorRunner - REQUESTER
GET /orders/ORD-7000/items HTTP/1.1
x-correlation-id: e5f6a7b8-0005-0005-0005-000000000005
Host: s-acme-legacy-orders.cloudhub.io:443
User-Agent: AHC/1.0

 spanId=99887766

2026-06-29T09:14:04.210Z DEBUG [wrk03] legacy-config event:e5f6a7b8-0005-0005-0005-000000000005 [x-acme-mobile-gateway].http.requester.legacy-config.01 SelectorRunner - REQUESTER
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 89

{"items":[{"id":"ITM-2","name":"Widget","qty":2,"price":9.99}]} spanId=99887766`;
