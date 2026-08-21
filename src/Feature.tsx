import { useEffect, useMemo, useState } from "react";
import {
  MeshNameInput,
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
  return minutes < 60 ? `${minutes}m left` : `${Math.ceil(minutes / 60)}h left`;
}

function areaLabel(id: AreaId): string {
  return GRID_AREAS.find((area) => area.id === id)?.label ?? "Unknown area";
}

function newId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function Feature({ room, config }: Props) {
  const namedPeer = useNamedPeer(config, room);
  const roster = useRoster(room);
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
  const shown = filter === "all" ? active : active.filter((item) => item.area === filter);

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
    setNotice("Shared as a coarse area pin. It expires in one hour.");
  };

  return (
    <main className="crowd-page">
      <section className="crowd-hero" aria-labelledby="crowd-title">
        <p className="eyebrow">Mesh Crowd Map</p>
        <h1 id="crowd-title">What’s happening—without tracking anyone.</h1>
        <p>
          Share a short-lived observation in a broad area you choose. This is a schematic grid, not
          a street map: no GPS, coordinates, tiles, or precise location collection.
        </p>
        <span className={`presence ${room ? "is-live" : ""}`}>
          <span aria-hidden="true" />{" "}
          {room ? `${Math.max(1, roster.present.length)} people connected` : "Joining room…"}
        </span>
      </section>

      <section className="crowd-layout" aria-label="Shared coarse observation board">
        <form className="card compose-card" onSubmit={addObservation}>
          <p className="eyebrow">Add an observation</p>
          <h2>Place a coarse pin</h2>
          <label>
            What did you notice?
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Short queue at registration"
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
              placeholder="Keep it useful; never add a person’s precise location."
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
          <button className="primary" type="submit" disabled={!room}>
            Share for one hour
          </button>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
        </form>

        <section className="card grid-card" aria-labelledby="grid-title">
          <div className="grid-heading">
            <div>
              <p className="eyebrow">Coarse area board</p>
              <h2 id="grid-title">Schematic, not GPS</h2>
            </div>
            <span>{active.length} active</span>
          </div>
          <div className="area-grid" role="group" aria-label="Filter observations by coarse area">
            {GRID_AREAS.map((item) => {
              const count = active.filter((observation) => observation.area === item.id).length;
              const selected = filter === item.id;
              return (
                <button
                  className={selected ? "area-cell is-selected" : "area-cell"}
                  type="button"
                  key={item.id}
                  onClick={() => setFilter(selected ? "all" : item.id)}
                  aria-pressed={selected}
                >
                  <strong>{item.label}</strong>
                  <span>{count ? `${count} pin${count === 1 ? "" : "s"}` : "No pins"}</span>
                </button>
              );
            })}
          </div>
          <p className="grid-caption">
            Choose a cell to filter the accessible observation list below.
          </p>
        </section>
      </section>

      <section className="card list-card" aria-labelledby="list-title">
        <div className="list-heading">
          <div>
            <p className="eyebrow">Accessible list</p>
            <h2 id="list-title">
              Observations {filter === "all" ? "everywhere" : `in ${areaLabel(filter)}`}
            </h2>
          </div>
          {filter !== "all" && (
            <button className="quiet" type="button" onClick={() => setFilter("all")}>
              Show all
            </button>
          )}
        </div>
        {shown.length === 0 ? (
          <p className="empty">
            No active observations here. Add a broad-area pin to help the room orient itself.
          </p>
        ) : (
          <ol className="observation-list">
            {shown
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((observation) => (
                <li key={observation.id}>
                  <div>
                    <span className="area-tag">{areaLabel(observation.area)}</span>
                    <strong>{observation.title}</strong>
                    {observation.note && <p>{observation.note}</p>}
                    <small>
                      Shared by {observation.author} · {timeUntil(observation.expiresAt)}
                    </small>
                  </div>
                  <button
                    className="quiet remove"
                    type="button"
                    onClick={() => observations.remove(observation.id)}
                    aria-label={`Remove ${observation.title}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
          </ol>
        )}
      </section>

      <section className="identity-card card">
        <div>
          <p className="eyebrow">Your card</p>
          <h2>{namedPeer.myName || "Add your name"}</h2>
        </div>
        <MeshNameInput
          value={namedPeer.name}
          onChange={namedPeer.setName}
          ariaLabel="Your display name"
          placeholder="How should this room know you?"
          maxLength={32}
        />
      </section>
      <p className="privacy-note">
        Every room peer can read coarse pins. Pins expire after one hour. This app deliberately does
        not request device location or render a precise map.
      </p>
    </main>
  );
}
