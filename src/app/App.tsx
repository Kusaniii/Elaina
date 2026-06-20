import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Pencil, Check, X, Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight, ImagePlus, Loader2, User, Clock, BookOpen } from "lucide-react";
import { useOcrTime } from "./useOcrTime";
import ImageCropperModal from "./ImageCropperModal";

// ─── Types ───────────────────────────────────────────────────────────────────

type TopicRow = {
  id: number;
  topic: string;
  time: number | string;
  status: string;
};

type Person = {
  id: number;
  name: string;
  topics: TopicRow[];
  collapsed: boolean;
};

// ─── Helpers (Định dạng HH:MM:SS) ───────────────────────────────────────────

function secsToHhmmss(secs: number | string): string {
  const n = typeof secs === "string" ? parseInt(secs, 10) : secs;
  if (isNaN(n) || n < 0) return ""; 
  
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = Math.floor(n % 60);
  
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function hhmmssToSecs(val: string): number {
  if (!val.trim()) return 0;
  const parts = val.split(":");
  
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    if (!isNaN(h) && !isNaN(m) && !isNaN(s)) return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
  }
  
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

function emptyTopic(id: number): TopicRow {
  return { id, topic: "", time: "", status: "" };
}

function totalSecs(topics: TopicRow[]): number {
  return topics.reduce((sum, t) => {
    const secs = typeof t.time === "string" ? hhmmssToSecs(t.time) : t.time;
    return sum + (secs || 0);
  }, 0);
}

// ─── TimeInput ────────────────────────────────────────────────────────────────

function TimeInput({ value, onChange, autoFocus }: { value: number | string; onChange: (s: number | string) => void; autoFocus?: boolean }) {
  const [local, setLocal] = useState(typeof value === "number" ? secsToHhmmss(value) : value);

  useEffect(() => {
    setLocal(typeof value === "number" ? secsToHhmmss(value) : value);
  }, [value]);

  function commit(raw: string) {
    if (!raw.trim()) {
      onChange("");
      setLocal("");
      return;
    }
    
    let v = raw.replace(/[^0-9:]/g, "");
    if (!v.includes(":")) {
      if (v.length > 4) {
        v = v.slice(0, v.length - 4) + ":" + v.slice(v.length - 4, v.length - 2) + ":" + v.slice(-2);
      } else if (v.length > 2) {
        v = v.slice(0, v.length - 2) + ":" + v.slice(-2);
      }
    }
    
    const secs = hhmmssToSecs(v);
    onChange(secs);
    setLocal(secsToHhmmss(secs));
  }

  return (
    <input
      autoFocus={autoFocus}
      type="text"
      placeholder="00:00:00"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="w-24 md:w-28 bg-white border border-border rounded-md px-2 py-1 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
    />
  );
}

// ─── TopicRowEditor ───────────────────────────────────────────────────────────

function TopicRowEditor({
  row,
  onChange,
  autoFocus,
}: {
  row: TopicRow;
  onChange: (updated: TopicRow) => void;
  autoFocus?: boolean;
}) {
  return (
    <>
      <td className="px-3 py-2 hidden md:table-cell">
        <input
          autoFocus={autoFocus}
          type="text"
          value={row.topic}
          onChange={(e) => onChange({ ...row, topic: e.target.value })}
          className="w-full bg-white border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </td>
      <td className="px-3 py-2 hidden md:table-cell">
        <TimeInput value={row.time} onChange={(v) => onChange({ ...row, time: v })} />
      </td>
    </>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [persons, setPersons] = useState<Person[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("learning_app_persons");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [nextPersonId, setNextPersonId] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("learning_app_next_person_id");
      return saved ? parseInt(saved, 10) : 1;
    }
    return 1;
  });

  const [nextTopicId, setNextTopicId] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("learning_app_next_topic_id");
      return saved ? parseInt(saved, 10) : 1;
    }
    return 1;
  });

  const [editingTopic, setEditingTopic] = useState<{ personId: number; topicId: number } | null>(null);
  const [editTopicState, setEditTopicState] = useState<TopicRow | null>(null);
  const [editingName, setEditingName] = useState<number | null>(null);
  const [editNameVal, setEditNameVal] = useState("");

  const [addingPerson, setAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [addingTopic, setAddingTopic] = useState<number | null>(null);
  const [newTopicRow, setNewTopicRow] = useState<TopicRow | null>(null);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [activeUploadPersonId, setActiveUploadPersonId] = useState<number | null>(null);
  const [dragOverPersonId, setDragOverPersonId] = useState<number | null>(null);

  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [targetPersonId, setTargetPersonId] = useState<number | null>(null);

  const { processImage, isOcrLoading } = useOcrTime();

  const newPersonRef = useRef<HTMLInputElement>(null);
  const newTopicRef = useRef<HTMLTableRowElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (addingPerson) newPersonRef.current?.focus(); }, [addingPerson]);
  useEffect(() => { if (addingTopic !== null) newTopicRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [addingTopic]);

  useEffect(() => { localStorage.setItem("learning_app_persons", JSON.stringify(persons)); }, [persons]);
  useEffect(() => { localStorage.setItem("learning_app_next_person_id", nextPersonId.toString()); }, [nextPersonId]);
  useEffect(() => { localStorage.setItem("learning_app_next_topic_id", nextTopicId.toString()); }, [nextTopicId]);

  function updatePerson(id: number, updater: (p: Person) => Person) {
    setPersons((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
  }

  function cleanTopicRow(row: TopicRow): TopicRow {
    return { ...row, time: row.time === "" ? 0 : row.time };
  }

  function toggleCollapse(personId: number) {
    updatePerson(personId, (p) => ({ ...p, collapsed: !p.collapsed }));
  }
  function startEditName(p: Person) { setEditingName(p.id); setEditNameVal(p.name); }
  function saveEditName(personId: number) { updatePerson(personId, (p) => ({ ...p, name: editNameVal })); setEditingName(null); }

  function startEditTopic(personId: number, row: TopicRow) {
    setEditingTopic({ personId, topicId: row.id });
    setEditTopicState({ ...row });
  }

  function saveEditTopic() {
    if (!editingTopic || !editTopicState) return;
    updatePerson(editingTopic.personId, (p) => ({
      ...p,
      topics: p.topics.map((t) => (t.id === editingTopic.topicId ? cleanTopicRow(editTopicState) : t)),
    }));
    setEditingTopic(null);
    setEditTopicState(null);
  }

  function cancelEditTopic() { setEditingTopic(null); setEditTopicState(null); }

  function deleteTopic(personId: number, topicId: number) {
    updatePerson(personId, (p) => {
      const remaining = p.topics.filter((t) => t.id !== topicId);
      if (remaining.length === 0) {
        setPersons((prev) => prev.filter((pp) => pp.id !== personId));
        return p;
      }
      return { ...p, topics: remaining };
    });
  }

  function saveNewPerson() {
    if (!newPersonName.trim()) return;
    const newP: Person = { id: nextPersonId, name: newPersonName.trim(), topics: [cleanTopicRow(emptyTopic(nextTopicId))], collapsed: false };
    setPersons((prev) => [...prev, newP]); setNextPersonId((n) => n + 1); setNextTopicId((n) => n + 1); setAddingPerson(false); setNewPersonName("");
  }
  function startAddTopic(personId: number) { setAddingTopic(personId); setNewTopicRow(emptyTopic(nextTopicId)); setNextTopicId((n) => n + 1); }
  function saveNewTopic(personId: number) { if (!newTopicRow) return; updatePerson(personId, (p) => ({ ...p, topics: [...p.topics, cleanTopicRow(newTopicRow)] })); setAddingTopic(null); setNewTopicRow(null); }
  function cancelNewTopic() { setAddingTopic(null); setNewTopicRow(null); }
  function deletePerson(personId: number) { setPersons((prev) => prev.filter((p) => p.id !== personId)); }

  function triggerImageUpload(personId: number) {
    setActiveUploadPersonId(personId);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  function insertSecondsToPerson(personId: number, secondsArray: number[]) {
    if (secondsArray.length === 0) return;
    let currentTopicIdPointer = nextTopicId;

    setPersons((prev) =>
      prev.map((p) => {
        if (p.id !== personId) return p;
        const updatedTopics = [...p.topics];
        secondsArray.forEach((seconds, idx) => {
          if (idx === 0 && updatedTopics.length === 1 && (updatedTopics[0].time === "" || updatedTopics[0].time === 0) && updatedTopics[0].topic === "") {
            updatedTopics[0] = { ...updatedTopics[0], time: seconds, topic: "" };
          } else {
            updatedTopics.push({ id: currentTopicIdPointer, topic: "", time: seconds, status: "" });
            currentTopicIdPointer++;
          }
        });
        return { ...p, topics: updatedTopics };
      })
    );
    setNextTopicId(currentTopicIdPointer);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || activeUploadPersonId === null) return;
    setTargetPersonId(activeUploadPersonId);
    setCropImageSrc(URL.createObjectURL(file));
    setActiveUploadPersonId(null);
  }

  function handleDragOver(e: React.DragEvent, personId: number) {
    e.preventDefault();
    setDragOverPersonId(personId);
  }

  function handleDragLeave() { setDragOverPersonId(null); }

  async function handleDrop(e: React.DragEvent, personId: number) {
    e.preventDefault(); setDragOverPersonId(null);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setTargetPersonId(personId);
    setCropImageSrc(URL.createObjectURL(file));
  }

  async function handleCropComplete(croppedFile: File) {
    if (targetPersonId === null) return;
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc(null);
    const secondsArray = await processImage(croppedFile);
    insertSecondsToPerson(targetPersonId, secondsArray);
    setTargetPersonId(null);
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else { setSortKey(key); setSortDir("asc"); }
  }

  const filteredPersons = persons
    .map((p) => ({
      ...p,
      topics: p.topics.filter((t) =>
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        t.topic.toLowerCase().includes(search.toLowerCase()) ||
        t.status.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((p) => p.topics.length > 0)
    .sort((a, b) => {
      if (!sortKey || sortKey !== "name") return 0;
      const cmp = a.name.localeCompare(b.name, "vi");
      return sortDir === "asc" ? cmp : -cmp;
    });

  const totalTopicCount = filteredPersons.reduce((sum, p) => sum + p.topics.length, 0);
  const absoluteTotalSecs = persons.reduce((sum, p) => sum + totalSecs(p.topics), 0);

  const totalRenderedRows = filteredPersons.reduce((sum, p) => {
    const topicCount = p.collapsed ? 1 : p.topics.length;
    const addingCount = addingTopic === p.id ? 1 : 0;
    return sum + topicCount + addingCount;
  }, 0);

  function SortIcon({ colKey }: { colKey: string }) {
    const active = sortKey === colKey;
    const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <button onClick={() => handleSort(colKey)} className={`flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}>
        <Icon size={13} className={active ? "opacity-100" : "opacity-40"} />
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isOcrLoading} />

      {cropImageSrc && (
        <ImageCropperModal 
          imageSrc={cropImageSrc} 
          onClose={() => { if (cropImageSrc) URL.revokeObjectURL(cropImageSrc); setCropImageSrc(null); setTargetPersonId(null); }} 
          onCropComplete={handleCropComplete} 
        />
      )}

      {isOcrLoading && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card p-5 rounded-xl border border-border shadow-lg flex items-center gap-3 max-w-sm w-full">
            <Loader2 className="animate-spin text-primary shrink-0" size={20} />
            <span className="text-xs md:text-sm font-medium text-foreground">Đang xử lý hình ảnh và quét mốc thời gian...</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-card border-b border-border px-4 md:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            <input
              type="text"
              placeholder="Tìm tên hoặc chủ đề..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
            />
          </div>
          <button
            onClick={() => { setAddingPerson(true); setAddingTopic(null); }}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 shrink-0 font-medium"
          >
            <Plus size={14} /> <span className="hidden sm:inline">Thêm học viên</span><span className="sm:hidden">Thêm</span>
          </button>
        </div>
      </div>

      {/* BANNER TỔNG THỜI GIAN TUYỆT ĐỐI TRÊN MOBILE */}
      <div className="block md:hidden px-4 pt-4">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tổng thời gian toàn bộ:</span>
          </div>
          <span className="font-mono font-bold text-primary text-base">{secsToHhmmss(absoluteTotalSecs)}</span>
        </div>
      </div>

      {/* Main Content View Container */}
      <div className="flex-1 px-4 md:px-6 py-4 md:py-5">
        <div className="max-w-7xl mx-auto">
          
          {/* 📱 1. MOBILE RESPONSIVE CARD VIEW (Hiển thị mượt mà trên Mobile) */}
          <div className="block md:hidden space-y-4">
            {addingPerson && (
              <div className="bg-primary/5 border border-primary/30 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="text-xs font-semibold text-primary flex items-center gap-1"><Plus size={14}/> Thêm học viên mới</div>
                <input
                  ref={newPersonRef}
                  type="text"
                  placeholder="Nhập họ và tên..."
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setAddingPerson(false); setNewPersonName(""); }} className="px-3 py-1.5 text-xs bg-muted rounded-md text-muted-foreground">Hủy</button>
                  <button onClick={saveNewPerson} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md font-medium">Lưu lại</button>
                </div>
              </div>
            )}

            {filteredPersons.map((person) => {
              const personTotal = totalSecs(person.topics);
              return (
                <div key={person.id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
                  {/* Card Header */}
                  <div className="p-3.5 bg-muted/30 border-b border-border flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      {editingName === person.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            type="text"
                            value={editNameVal}
                            onChange={(e) => setEditNameVal(e.target.value)}
                            className="bg-white border border-border rounded px-2 py-0.5 text-sm focus:outline-none"
                          />
                          <button onClick={() => saveEditName(person.id)} className="p-1 text-emerald-600"><Check size={14}/></button>
                          <button onClick={() => setEditingName(null)} className="p-1 text-muted-foreground"><X size={14}/></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 group">
                          <span className="font-semibold text-foreground text-sm">{person.name}</span>
                          <button onClick={() => startEditName(person)} className="p-1 text-muted-foreground hover:text-primary"><Pencil size={12}/></button>
                          <button onClick={() => deletePerson(person.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={12}/></button>
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1"><BookOpen size={12}/> {person.topics.length} chủ đề</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Tổng thời lượng</div>
                      <div className="font-mono font-bold text-foreground text-sm">{secsToHhmmss(personTotal)}</div>
                    </div>
                  </div>

                  {/* Card Topics List */}
                  <div className="p-3 space-y-2 bg-card/50">
                    {person.topics.map((topic) => {
                      const isEditingThis = editingTopic?.personId === person.id && editingTopic?.topicId === topic.id;
                      return (
                        <div key={topic.id} className="p-2 bg-background border border-border rounded-lg flex items-center justify-between gap-3 text-xs">
                          {isEditingThis && editTopicState ? (
                            <div className="flex-1 flex flex-col gap-2">
                              <input
                                type="text"
                                value={editTopicState.topic}
                                onChange={(e) => setEditTopicState({ ...editTopicState, topic: e.target.value })}
                                className="w-full border border-border rounded px-2 py-1 bg-white"
                                placeholder="Chủ đề..."
                              />
                              <div className="flex items-center justify-between">
                                <TimeInput value={editTopicState.time} onChange={(v) => setEditTopicState({ ...editTopicState, time: v })} />
                                <div className="flex gap-1">
                                  <button onClick={saveEditTopic} className="p-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded"><Check size={14}/></button>
                                  <button onClick={cancelEditTopic} className="p-1 bg-muted text-muted-foreground rounded"><X size={14}/></button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="truncate font-medium text-foreground pr-1">
                                {topic.topic || <span className="text-muted-foreground italic text-[11px]">Chưa đặt chủ đề</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono bg-muted px-2 py-0.5 rounded text-foreground font-semibold">{topic.time === "" || topic.time === 0 ? "00:00:00" : secsToHhmmss(topic.time)}</span>
                                <div className="flex gap-0.5 border-l border-border pl-1.5">
                                  <button onClick={() => startEditTopic(person.id, topic)} className="p-1 text-muted-foreground hover:text-primary"><Pencil size={13}/></button>
                                  <button onClick={() => deleteTopic(person.id, topic.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={13}/></button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {/* Form thêm chủ đề mới trên Mobile */}
                    {addingTopic === person.id && newTopicRow && (
                      <div className="p-2 bg-primary/5 border border-primary/20 border-dashed rounded-lg flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Chủ đề mới..."
                          value={newTopicRow.topic}
                          onChange={(e) => setNewTopicRow({ ...newTopicRow, topic: e.target.value })}
                          className="w-full text-xs border border-border rounded px-2 py-1 bg-white"
                        />
                        <div className="flex items-center justify-between">
                          <TimeInput value={newTopicRow.time} onChange={(v) => setNewTopicRow({ ...newTopicRow, time: v })} />
                          <div className="flex gap-1">
                            <button onClick={() => saveNewTopic(person.id)} className="p-1 bg-primary text-primary-foreground rounded"><Check size={14}/></button>
                            <button onClick={cancelNewTopic} className="p-1 bg-muted text-muted-foreground rounded"><X size={14}/></button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-2 border-t border-border bg-muted/10 flex items-center justify-between gap-2 mt-auto">
                    <button
                      onClick={() => triggerImageUpload(person.id)}
                      className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20"
                    >
                      <ImagePlus size={13} /> Quét ảnh OCR
                    </button>
                    {addingTopic !== person.id && (
                      <button onClick={() => startAddTopic(person.id)} className="text-[11px] font-medium text-muted-foreground hover:text-primary flex items-center gap-0.5 px-2 py-1">
                        <Plus size={13} /> Thêm chủ đề
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 🖥️ 2. DESKTOP ORIGINAL TABLE VIEW (Giữ nguyên giao diện gộp hàng trên Desktop lớn) */}
          <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/60 border-b border-border">
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-8">#</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap w-[240px]">
                      <div className="flex items-center gap-1">Họ và tên <SortIcon colKey="name" /></div>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Chủ đề</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Thời gian</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Tổng</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Tổng thời gian</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {addingPerson && (
                    <tr className="border-b border-border bg-primary/5">
                      <td className="px-3 py-2.5 text-primary"><Plus size={14} /></td>
                      <td className="px-3 py-2.5" colSpan={5}>
                        <input
                          ref={newPersonRef}
                          type="text"
                          value={newPersonName}
                          onChange={(e) => setNewPersonName(e.target.value)}
                          className="w-full bg-white border border-border rounded-md px-2 py-1 text-sm focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={saveNewPerson} className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50"><Check size={15} /></button>
                          <button onClick={() => { setAddingPerson(false); setNewPersonName(""); }} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"><X size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredPersons.map((person, personIdx) => {
                    const visibleTopics = person.collapsed ? [] : person.topics;
                    const isAddingTopicHere = addingTopic === person.id;
                    const personRowSpan = visibleTopics.length + (isAddingTopicHere ? 1 : 0);
                    const personTotalSecs = totalSecs(person.topics);
                    const isBeingDraggedOver = dragOverPersonId === person.id;

                    return visibleTopics.map((topic, topicIdx) => {
                      const isFirstOfPerson = topicIdx === 0;
                      const isLastOfPerson = topicIdx === visibleTopics.length - 1 && !isAddingTopicHere;
                      const isEditingThis = editingTopic?.personId === person.id && editingTopic?.topicId === topic.id;
                      const isFirstRowOfAllTable = personIdx === 0 && topicIdx === 0;

                      return (
                        <tr
                          key={`${person.id}-${topic.id}`}
                          onDragOver={(e) => handleSort !== null && handleDragOver(e, person.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, person.id)}
                          className={`border-b border-border transition-all ${
                            isBeingDraggedOver ? "bg-primary/10 scale-[0.99] border-dashed border-primary" : isEditingThis ? "bg-accent/60" : "hover:bg-muted/40"
                          }`}
                        >
                          {isFirstOfPerson && <td rowSpan={personRowSpan} className="px-3 py-2.5 text-muted-foreground align-top border-r border-border/50">{personIdx + 1}</td>}
                          {isFirstOfPerson && (
                            <td rowSpan={personRowSpan} className="px-3 py-2.5 align-top border-r border-border/50 min-w-[200px]">
                              <div className="flex items-start gap-1.5">
                                <button onClick={() => toggleCollapse(person.id)} className="mt-0.5 p-0.5 rounded hover:bg-muted text-muted-foreground"><ChevronRight size={14} className={`transition-transform ${person.collapsed ? "" : "rotate-90"}`} /></button>
                                <div className="flex-1 flex flex-col">
                                  {editingName === person.id ? (
                                    <div className="flex items-center gap-1">
                                      <input autoFocus type="text" value={editNameVal} onChange={(e) => setEditNameVal(e.target.value)} className="w-full bg-white border border-border rounded px-2 py-0.5 text-sm" />
                                      <button onClick={() => saveEditName(person.id)} className="p-1 rounded text-emerald-600"><Check size={13} /></button>
                                      <button onClick={() => setEditingName(null)} className="p-1 rounded text-muted-foreground"><X size={13} /></button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 group">
                                      <span className="font-medium text-foreground">{person.name}</span>
                                      <div className="flex opacity-0 group-hover:opacity-100 gap-0.5 ml-1">
                                        <button onClick={() => startEditName(person)} className="p-0.5 rounded text-muted-foreground hover:text-primary"><Pencil size={12} /></button>
                                        <button onClick={() => deletePerson(person.id)} className="p-0.5 rounded text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                                      </div>
                                    </div>
                                  )}
                                  <span className="text-xs text-muted-foreground">{person.topics.length} chủ đề</span>
                                  <div className="mt-2.5 flex flex-col gap-1.5 w-full max-w-[190px] group/drop">
                                    <button onClick={() => triggerImageUpload(person.id)} className="flex items-center justify-center gap-1.5 w-full px-2.5 py-1.5 text-xs font-semibold bg-primary/10 text-primary rounded-md border border-primary/20"><ImagePlus size={14} /> <span>Quét ảnh thời gian</span></button>
                                    <div className="text-[10px] font-medium text-center text-muted-foreground py-1.5 border border-dashed border-muted-foreground/40 rounded-md bg-muted/40 select-none group-hover/drop:border-primary/50 group-hover/drop:text-primary transition-all">hoặc drop ảnh vào đây</div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          )}

                          {isEditingThis && editTopicState ? (
                            <TopicRowEditor row={editTopicState} onChange={setEditTopicState} autoFocus />
                          ) : (
                            <>
                              <td className="px-3 py-2.5">{topic.topic || <span className="text-muted-foreground italic text-xs">Chưa có chủ đề</span>}</td>
                              <td className="px-3 py-2.5 font-mono text-foreground">{topic.time === "" || topic.time === 0 ? "00:00:00" : secsToHhmmss(topic.time)}</td>
                            </>
                          )}

                          {isFirstOfPerson && <td rowSpan={personRowSpan} className="px-3 py-2.5 align-middle font-mono font-semibold text-foreground text-center border-l border-border/50 bg-card">{secsToHhmmss(personTotalSecs)}</td>}
                          {isFirstRowOfAllTable && (
                            <td rowSpan={totalRenderedRows} className="px-4 py-2.5 align-middle text-center border-l border-border/50 bg-card/60 min-w-[120px]">
                              <div className="flex flex-col items-center justify-center gap-1.5 py-4">
                                <span className="font-mono font-bold text-primary text-lg tracking-tight bg-primary/10 px-2.5 py-1 rounded-md shadow-sm">{secsToHhmmss(absoluteTotalSecs)}</span>
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tổng cộng tất cả</span>
                              </div>
                            </td>
                          )}

                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              {isEditingThis ? (
                                <>
                                  <button onClick={saveEditTopic} className="p-1.5 rounded-md text-emerald-600"><Check size={15} /></button>
                                  <button onClick={cancelEditTopic} className="p-1.5 rounded-md text-muted-foreground"><X size={15} /></button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => startEditTopic(person.id, topic)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary"><Pencil size={15} /></button>
                                  <button onClick={() => deleteTopic(person.id, topic.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button>
                                  {isLastOfPerson && <button onClick={() => startAddTopic(person.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary"><Plus size={15} /></button>}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }).concat(
                      person.collapsed ? [(
                        <tr key={`${person.id}-collapsed`} className="border-b border-border bg-muted/20">
                          <td className="px-3 py-2.5 text-muted-foreground">{personIdx + 1}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-start gap-1.5">
                              <button onClick={() => toggleCollapse(person.id)} className="mt-0.5 p-0.5 rounded hover:bg-muted text-muted-foreground"><ChevronRight size={14} /></button>
                              <div className="flex-1 flex flex-col">
                                <div className="flex items-center gap-1"><span className="font-medium text-foreground">{person.name}</span><span className="text-xs text-muted-foreground ml-1">({person.topics.length} chủ đề)</span></div>
                                <div className="mt-2.5 flex flex-col gap-1.5 w-full max-w-[190px]">
                                  <button onClick={() => triggerImageUpload(person.id)} className="flex items-center justify-center gap-1.5 w-full px-2.5 py-1.5 text-xs font-semibold bg-primary/10 text-primary rounded-md border border-primary/20"><ImagePlus size={14} /> <span>Quét ảnh thời gian</span></button>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td colSpan={2} />
                          <td className="px-3 py-2.5 font-mono text-center font-semibold text-foreground border-l border-border/50 bg-card">{secsToHhmmss(personTotalSecs)}</td>
                          {personIdx === 0 && (
                            <td rowSpan={totalRenderedRows} className="px-4 py-2.5 align-middle text-center border-l border-border/50 bg-card/60">
                              <span className="font-mono font-bold text-primary text-lg bg-primary/10 px-2 py-0.5 rounded">{secsToHhmmss(absoluteTotalSecs)}</span>
                            </td>
                          )}
                          <td className="px-3 py-2.5"><div className="flex items-center justify-end gap-1"><button onClick={() => startEditName(person)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary"><Pencil size={15} /></button><button onClick={() => deletePerson(person.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button></div></td>
                        </tr>
                      )] : []
                    ).concat(
                      isAddingTopicHere && newTopicRow ? [(
                        <tr ref={newTopicRef} key={`${person.id}-new-topic`} className="border-b border-border bg-primary/5">
                          <TopicRowEditor row={newTopicRow} onChange={setNewTopicRow} autoFocus />
                          <td className="px-3 py-2.5" colSpan={2} /> 
                          <td className="px-3 py-2.5"><div className="flex items-center justify-end gap-1"><button onClick={() => saveNewTopic(person.id)} className="p-1.5 rounded-md text-emerald-600"><Check size={15} /></button><button onClick={cancelNewTopic} className="p-1.5 rounded-md text-muted-foreground"><X size={15} /></button></div></td>
                        </tr>
                      )] : []
                    );
                  })}

                  {filteredPersons.length === 0 && !addingPerson && (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-muted-foreground">
                        {search ? `Không tìm thấy kết quả cho "${search}"` : `Chưa có dữ liệu. Nhấn "Thêm học viên" để bắt đầu.`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="border-t border-border bg-muted/30 px-5 py-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{persons.length} học viên · {totalTopicCount} chủ đề</span>
              <button onClick={() => { setAddingPerson(true); setAddingTopic(null); }} className="flex items-center gap-1 hover:text-primary"><Plus size={12} /> Thêm học viên</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}