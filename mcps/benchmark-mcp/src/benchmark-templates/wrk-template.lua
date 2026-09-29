-- Built-in wrk benchmark template for benchmark-mcp.
-- The server replaces the ENDPOINTS placeholder below before execution.
-- wrk connects to a single host (given on the command line); each endpoint's
-- path must be a path+query on that host.

local endpoints = __ENDPOINTS__
local idx = 0

request = function()
  idx = idx + 1
  local ep = endpoints[((idx - 1) % #endpoints) + 1]
  wrk.method = ep.method or "GET"
  wrk.path = ep.path
  wrk.body = ep.body
  wrk.headers = ep.headers or {}
  return wrk.format()
end

done = function(summary, latency, requests)
  -- Let wrk print its standard summary; nothing extra needed here.
end
