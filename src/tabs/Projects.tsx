import type { ProjectsData, RepoStatus } from '../types';
import { EmptyState, InfoBox, SectionLabel } from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { ProjectCard } from '../components/ProjectCard';

const repoColumns: Column<RepoStatus>[] = [
  { key: 'name', header: 'Repo', render: (r) => <span className="label">{r.name}</span> },
  { key: 'visibility', header: 'Visibility', render: (r) => <span className="sub">{r.visibility}</span> },
  { key: 'status', header: 'Status', render: (r) => <span className="sub">{r.status}</span> },
];

export function Projects({ data }: { data: ProjectsData | undefined }) {
  return (
    <div className="tab-page">
      <div className="page-header">
        <h1>
          Personal <span className="accent">Projects</span>
        </h1>
        {data?.summary ? <div className="page-sub">{data.summary}</div> : null}
      </div>

      {!data ? (
        <EmptyState label="No project data yet." />
      ) : (
        <>
          <div className="grid cols-2">
            {data.cards.map((project) => (
              <ProjectCard project={project} key={project.id} />
            ))}
          </div>

          {data.sportsCards.length > 0 ? (
            <>
              <SectionLabel>Sports / Fantasy</SectionLabel>
              <div className="grid cols-2">
                {data.sportsCards.map((project) => (
                  <ProjectCard project={project} key={project.id} />
                ))}
              </div>
            </>
          ) : null}

          <SectionLabel>GitHub Repos</SectionLabel>
          <div className="card">
            <DataTable columns={repoColumns} rows={data.repos} getRowId={(r) => r.id} />
            {data.repoNote ? <InfoBox>{data.repoNote}</InfoBox> : null}
          </div>
        </>
      )}
    </div>
  );
}
