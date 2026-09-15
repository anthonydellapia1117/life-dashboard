import type { ProjectCard as ProjectCardData } from '../types';
import { Pill } from './ui';

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const paragraphs = project.body.split('\n\n');
  return (
    <div className="project-card">
      <div className="pc-header">
        <div>
          <div className="pc-title">{project.title}</div>
          {project.subtitle ? <div className="pc-sub">{project.subtitle}</div> : null}
        </div>
        <Pill tone={project.pill}>{project.pillLabel}</Pill>
      </div>
      <div className="pc-body">
        {paragraphs.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
      {project.liveUrl ? (
        <a className="pc-link" href={project.liveUrl} target="_blank" rel="noreferrer">
          {project.liveUrl.replace(/^https?:\/\//, '')}
        </a>
      ) : null}
      {project.stats && project.stats.length > 0 ? (
        <div className="pc-stats">
          {project.stats.map((stat) => (
            <div className="pc-stat" key={stat.label}>
              <div className="pc-stat-num">{stat.value}</div>
              <div className="pc-stat-lbl">{stat.label}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
