import React, { useEffect, useMemo, useState } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { api } from "../lib/mockApi";

const typeToLabel = (t) => {
  if (!t) return "event";
  if (t.startsWith("agent.")) return "agent";
  if (t.startsWith("ui.")) return "ui";
  if (t.startsWith("system.")) return "system";
  return "event";
};

const eventToMessage = (evt) => {
  const t = evt?.type || "";
  const p = evt?.payload || {};
  if (t === "email.queued") return p.type === "IT_LOW_STOCK" ? "IT low-stock email queued..." : "Welcome email queued...";
  if (t === "email.sent") return p?.meta?.type === "IT_LOW_STOCK" ? "IT low-stock email sent (logged)." : "Welcome email sent (logged).";
  if (t === "email.error") return p.type === "IT_LOW_STOCK" ? `IT low-stock email failed: ${p.error || "unknown error"}` : `Welcome email failed: ${p.error || "unknown error"}`;
  return null;
};

export default function AgentActivity() {
  const [events, setEvents] = useState([]);
  const wsEndpoint = useMemo(() => {
    try {
      return api.wsUrl();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!wsEndpoint) return;

    let ws;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(wsEndpoint);

      ws.onmessage = (msg) => {
        try {
          const evt = JSON.parse(msg.data);
          setEvents((prev) => [...prev, evt].slice(-80));
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (closed) return;
        setTimeout(connect, 800);
      };
    };

    connect();

    return () => {
      closed = true;
      try {
        ws && ws.close();
      } catch {}
    };
  }, [wsEndpoint]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Agent Activity</div>
        <div className="text-xs opacity-70">Live</div>
      </div>

      <div className="h-64 overflow-auto border rounded-md p-2 bg-white/40">
        {events.length === 0 ? (
          <div className="text-sm opacity-70">Waiting for agent events…</div>
        ) : (
          <div className="space-y-2">
            {events.map((e, idx) => (
              <div key={idx} className="text-sm flex gap-2 items-start">
                <Badge variant="secondary" className="mt-0.5">
                  {typeToLabel(e.type)}
                </Badge>
                <div className="min-w-0">
                  <div className="text-xs opacity-70">
                    {e.ts} — {e.type}
                  </div>
                  {eventToMessage(e) ? (
                    <div className="text-xs text-blue-700 py-1">{eventToMessage(e)}</div>
                  ) : null}
                  <pre className="text-xs whitespace-pre-wrap break-words m-0">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
