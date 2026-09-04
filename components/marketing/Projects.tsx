"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { ProjectEntry } from "@/lib/projects-store";

export default function Projects() {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => {});
  }, []);

  if (projects.length === 0) return null;

  return (
    <section id="du-an" className="bg-surface py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-[28px] font-semibold text-navy sm:text-3xl">Dự án đã thực hiện</h2>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {projects.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-card border border-line bg-white">
              <div className="relative aspect-[4/3] overflow-hidden bg-surface">
                {p.imageUrl && <Image src={p.imageUrl} alt={`${p.type} — ${p.capacity}`} fill className="object-cover" />}
              </div>
              <div className="p-5">
                <div className="font-mono text-lg font-semibold text-navy">{p.capacity}</div>
                <div className="mt-1 text-[13.5px] text-ink/60">
                  {p.type} · {p.location}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
