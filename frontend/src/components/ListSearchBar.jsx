import { useEffect, useState } from "react";

export default function ListSearchBar({ value, onChange, placeholder = "Cari..." }) {
  const [draft, setDraft] = useState(value || "");

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  function submit(e) {
    e.preventDefault();
    onChange(draft.trim());
  }

  function clear() {
    setDraft("");
    onChange("");
  }

  return (
    <form className="search-bar" onSubmit={submit}>
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label="Pencarian"
      />
      <button type="submit" className="btn btn-primary btn-sm">Cari</button>
      {value && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={clear}>
          Reset
        </button>
      )}
    </form>
  );
}
