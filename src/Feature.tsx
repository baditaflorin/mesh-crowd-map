import { useEffect, useMemo, useRef, useState } from "react";
import {
  MeshButton,
  MeshLaunch,
  MeshNameInput,
  MeshPresence,
  MeshStatusPill,
  MeshSurface,
  useNamedPeer,
  useRoster,
  useSharedCollection,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

const OBSERVATION_TTL_MS = 60 * 60_000;
const GRID_AREAS = [
  { id: "north-west", label: "Northwest", x: 0, y: 0 },
  { id: "north", label: "North", x: 1, y: 0 },
  { id: "north-east", label: "Northeast", x: 2, y: 0 },
  { id: "west", label: "West", x: 0, y: 1 },
  { id: "centre", label: "Centre", x: 1, y: 1 },
  { id: "east", label: "East", x: 2, y: 1 },
  { id: "south-west", label: "Southwest", x: 0, y: 2 },
  { id: "south", label: "South", x: 1, y: 2 },
  { id: "south-east", label: "Southeast", x: 2, y: 2 },
] as const;

type AreaId = (typeof GRID_AREAS)[number]["id"];
export type Observation = {
  id: string;
  title: string;
  note: string;
  area: AreaId;
  createdAt: number;
  expiresAt: number;
  author: string;
};

type Props = { room: YRoom | null; config: MeshConfig };

function cleanText(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

export function isValidObservation(value: Observation): boolean {
  return (
    typeof value.id === "string" &&
    /^[a-f0-9]{16}$/.test(value.id) &&
    typeof value.title === "string" &&
    value.title.length >= 2 &&
    value.title.length <= 80 &&
    typeof value.note === "string" &&
    value.note.length <= 240 &&
    GRID_AREAS.some((area) => area.id === value.area) &&
    Number.isFinite(value.createdAt) &&
    Number.isFinite(value.expiresAt) &&
    value.expiresAt > value.createdAt &&
    typeof value.author === "string" &&
    value.author.length <= 32
  );
}

export function timeUntil(expiresAt: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.ceil((expiresAt - now) / 60_000));
  return minutes < 60 ? minutes + "m left" : Math.ceil(minutes / 60) + "h left";
}

function areaLabel(id: AreaId): string {
  return GRID_AREAS.find((area) => area.id === id)?.label ?? "Unknown area";
}

function pinLabel(count: number): string {
  return count === 1 ? "1 live note" : count + " live notes";
}

function newId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function Feature({ room, config }: Props) {
  const namedPeer = useNamedPeer(config, room);
  const roster = useRoster(room);
  const composerTitleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [area, setArea] = useState<AreaId>("centre");
  const [filter, setFilter] = useState<AreaId | "all">("all");
  const [notice, setNotice] = useState<string | null>(null);
  const observations = useSharedCollection<Observation>(room, "mesh-crowd-map:observations", {
    validate: isValidObservation,
  });

  const active = useMemo(
    () =>
      observations.items.filter((item) => isValidObservation(item) && item.expiresAt > Date.now()),
    [observations.items],
  );
  const activeByArea = useMemo(() => {
    const counts = new Map<AreaId, number>();
    for (const observation of active) {
      counts.set(observation.area, (counts.get(observation.area) ?? 0) + 1);
    }
    return counts;
  }, [active]);
  const shown = filter === "all" ? active : active.filter((item) => item.area === filter);
  const peopleHere = room ? Math.max(1, roster.present.length) : 0;
  const presenceLabel = room
    ? peopleHere === 1
      ? "person in this room"
      : "people in this room"
    : "people joining";

  useEffect(() => {
    const prune = () => {
      for (const item of observations.items) {
        if (isValidObservation(item) && item.expiresAt <= Date.now()) observations.remove(item.id);
      }
    };
    prune();
    const timer = window.setInterval(prune, 30_000);
    return () => window.clearInterval(timer);
  }, [observations]);

  const focusComposer = () => {
    document.getElementById("crowd-compose")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    window.setTimeout(() => composerTitleRef.current?.focus({ preventScroll: true }), 220);
  };

  const focusPrivacy = () => {
    document.getElementById("crowd-privacy")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const addObservation = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanTitle = cleanText(title, 80);
    const cleanNote = cleanText(note, 240);
    if (cleanTitle.length < 2) {
      setNotice("Give the observation a short title (at least 2 characters).");
      return;
    }
    const now = Date.now();
    const added = observations.add({
      id: newId(),
      title: cleanTitle,
      note: cleanNote,
      area,
      createdAt: now,
      expiresAt: now + OBSERVATION_TTL_MS,
      author: namedPeer.myName || "Anonymous",
    });
    if (!added) {
      setNotice("That observation could not be shared. Check its details and try again.");
      return;
    }
    setTitle("");
    setNote("");
    setNotice("Shared as a broad-area note. It expires in one hour.");
  };

  return (
    <main className="crowd-page">
      <MeshLaunch
        className="crowd-launch"
        eyebrow="Crowd Map · shared field note"
        heading="See the room, not the people."
        promise="Leave a short-lived note in a broad area. Crowd Map never requests GPS, coordinates, or a precise location."
        presence={
          <MeshPresence
            count={peopleHere}
            label={presenceLabel}
            state={room ? "connected" : "connecting"}
            size="md"
            announce="polite"
          />
        }
        preview={
          <MeshSurface
            as="section"
            className="crowd-board"
            tone="raised"
            padding="lg"
            aria-labelledby="crowd-board-title"
          >
            <div className="crowd-board-header">
              <div>
                <p className="crowd-kicker">The shared board</p>
                <h2 id="crowd-board-title">Broad areas, not locations.</h2>
              </div>
              <MeshStatusPill tone={room ? "live" : "warning"} dot>
                {pinLabel(active.length)}
              </MeshStatusPill>
            </div>
            <div
              className="crowd-area-grid"
              role="group"
              aria-label="Filter observations by broad area"
            >
              {GRID_AREAS.map((item) => {
                const count = activeByArea.get(item.id) ?? 0;
                const selected = filter === item.id;
                const cellLabel = count === 1 ? "1 note" : count + " notes";
                return (
                  <MeshButton
                    className={selected ? "crowd-area-cell is-selected" : "crowd-area-cell"}
                    variant={selected ? "primary" : "secondary"}
                    size="sm"
                    type="button"
                    key={item.id}
                    onClick={() => setFilter(selected ? "all" : item.id)}
                    aria-pressed={selected}
                    aria-label={
                      item.label + ", " + cellLabel + (selected ? ", selected" : ", not selected")
                    }
                  >
                    <strong>{item.label}</strong>
                    <span>{cellLabel}</span>
                  </MeshButton>
                );
              })}
            </div>
            <p className="crowd-board-caption">
              Select an area to filter the accessible list. Notes expire after one hour.
            </p>
          </MeshSurface>
        }
        primaryAction={{
          label: "Add an observation",
          onClick: focusComposer,
        }}
        secondaryAction={{
          label: "Why this stays private",
          onClick: focusPrivacy,
        }}
        loading={!room}
        connectionHint={
          room ? null : "Joining the shared board. You can still choose an area and prepare a note."
        }
      />

      <section className="crowd-workspace" aria-label="Create and review room observations">
        <MeshSurface
          as="section"
          className="crowd-compose"
          tone="accent"
          padding="lg"
          aria-labelledby="crowd-compose-title"
        >
          <header className="crowd-section-heading">
            <p className="crowd-kicker">Share a field note</p>
            <h2 id="crowd-compose-title">Put context on the board.</h2>
            <p>Keep it useful, broad, and temporary.</p>
          </header>
          <form id="crowd-compose" onSubmit={addObservation}>
            <label>
              What did you notice?
              <input
                ref={composerTitleRef}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Short queue at registration"
                maxLength={80}
                required
                minLength={2}
              />
            </label>
            <label>
              Optional context
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Keep it useful; never add a precise location."
                maxLength={240}
                rows={3}
              />
            </label>
            <label>
              Broad area
              <select value={area} onChange={(event) => setArea(event.target.value as AreaId)}>
                {GRID_AREAS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <MeshButton type="submit" fullWidth disabled={!room}>
              {room ? "Share for one hour" : "Joining room…"}
            </MeshButton>
            {notice && (
              <p className="crowd-notice" role="status">
                {notice}
              </p>
            )}
          </form>
        </MeshSurface>

        <MeshSurface
          as="section"
          className="crowd-observations"
          tone="raised"
          padding="lg"
          aria-labelledby="crowd-list-title"
        >
          <header className="crowd-list-header">
            <div>
              <p className="crowd-kicker">Accessible list</p>
              <h2 id="crowd-list-title">
                {filter === "all"
                  ? "What the room is noticing."
                  : "Notes in " + areaLabel(filter) + "."}
              </h2>
            </div>
            {filter !== "all" ? (
              <MeshButton variant="quiet" size="sm" type="button" onClick={() => setFilter("all")}>
                View all
              </MeshButton>
            ) : (
              <MeshStatusPill tone="info">All areas</MeshStatusPill>
            )}
          </header>
          {shown.length === 0 ? (
            <div className="crowd-empty">
              <MeshStatusPill tone="neutral" dot>
                No live notes yet
              </MeshStatusPill>
              <p>Add a broad-area note to help the room orient itself.</p>
            </div>
          ) : (
            <ol className="crowd-observation-list">
              {shown
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((observation) => (
                  <li key={observation.id}>
                    <div>
                      <MeshStatusPill tone="info" size="sm">
                        {areaLabel(observation.area)}
                      </MeshStatusPill>
                      <strong>{observation.title}</strong>
                      {observation.note && <p>{observation.note}</p>}
                      <small>
                        Shared by {observation.author} · {timeUntil(observation.expiresAt)}
                      </small>
                    </div>
                    <MeshButton
                      className="crowd-remove"
                      variant="quiet"
                      size="sm"
                      type="button"
                      onClick={() => observations.remove(observation.id)}
                      aria-label={"Remove " + observation.title}
                    >
                      Remove
                    </MeshButton>
                  </li>
                ))}
            </ol>
          )}
        </MeshSurface>
      </section>

      <section className="crowd-lower">
        <MeshSurface
          as="section"
          className="crowd-identity"
          tone="quiet"
          padding="md"
          aria-labelledby="crowd-identity-title"
        >
          <div>
            <p className="crowd-kicker">Your card</p>
            <h2 id="crowd-identity-title">Be recognisable, not identifiable.</h2>
            <p>Use a short display name so a room can place a note without collecting a profile.</p>
          </div>
          <MeshNameInput
            value={namedPeer.name}
            onChange={namedPeer.setName}
            label="Your display name"
            placeholder="How should this room know you?"
            maxLength={32}
            showCounter
            hint="Only this room sees it."
          />
        </MeshSurface>

        <MeshSurface
          as="aside"
          id="crowd-privacy"
          className="crowd-privacy"
          tone="quiet"
          padding="md"
          aria-label="Privacy promise"
        >
          <MeshStatusPill tone="info" dot>
            No GPS, coordinates, or map tiles
          </MeshStatusPill>
          <p>
            Every room peer can read broad-area notes. They disappear after one hour, and the layout
            deliberately avoids exact location data.
          </p>
        </MeshSurface>
      </section>
    </main>
  );
}
