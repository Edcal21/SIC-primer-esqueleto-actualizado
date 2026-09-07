"use client";
export default function MenuIcon({ name, className = "navIcon" }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    dashboard: "M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-4H4v4Zm10 0h6v-4h-6v4Z",
    users: "M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3ZM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5C23 14.17 18.33 13 16 13Z",
    entry: "M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4Z",
    catalog: "M5 4h14v3H5V4Zm0 6h14v3H5v-3Zm0 6h14v3H5v-3Z",
    church: "M12 2v4h3v2h-3v3l6 4v7h-5v-4h-2v4H6v-7l6-4V8H9V6h3V2Zm-4 14v4h2v-4H8Zm6 0v4h2v-4h-2Z",
    bank: "M12 3 3 8v2h18V8l-9-5ZM5 12v7H3v2h18v-2h-2v-7h-2v7h-3v-7h-2v7H9v-7H7v7H5v-7Z",
    upload: "M11 16h2V8l3.5 3.5 1.42-1.42L12 4.16 6.08 10.08 7.5 11.5 11 8v8Zm-5 2h12v2H6v-2Z",
    reports: "M5 3h14v18H5V3Zm3 4v2h8V7H8Zm0 4v2h8v-2H8Zm0 4v2h5v-2H8Z",
    audit: "M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-1 14-4-4 1.4-1.4 2.6 2.6 5.6-5.6L18 9l-7 7Z",
    search: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z",
    trash: "M9 3h6l1 2h4v2H4V5h4l1-2ZM6 9h12l-1.1 11.2A2 2 0 0 1 14.9 22H9.1a2 2 0 0 1-2-1.8L6 9Zm4 2v8h1.5v-8H10Zm2.5 0v8H14v-8h-1.5Z",
    info: "M11 7h2v2h-2V7Zm0 4h2v6h-2v-6Zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z",
    check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z",
    reconcile: "M9.01 14H2v2h7.01v3L13 15l-3.99-4v3Zm5.98-1v-3H22V8h-7.01V5L11 9l3.99 4Z",
    settings: "M3 17v2h6v-2H3ZM3 5v2h10V5H3Zm10 16v-2h8v-2h-8v-2h-2v6h2ZM7 9v2H3v2h4v2h2V9H7Zm14 4v-2H11v2h10Zm-6-4h2V7h4V5h-4V3h-2v6Z",
  };
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name] ?? paths.dashboard}/></svg>;
}
