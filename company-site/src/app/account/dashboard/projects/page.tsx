import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function CustomProjectsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const customProjects = await prisma.customProject.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      selectedVector: true,
      proteins: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Separate custom vectors and custom strains
  const customVectorProjects = customProjects.filter(
    (p) => p.selectedVectorId !== null
  );
  const customStrainProjects = customProjects.filter(
    (p) =>
      p.projectType === "STRAIN_ONLY" || p.projectType === "STRAIN_AND_TESTING"
  );
  const otherProjects = customProjects.filter(
    (p) =>
      p.selectedVectorId === null &&
      p.projectType !== "STRAIN_ONLY" &&
      p.projectType !== "STRAIN_AND_TESTING"
  );

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
    }).format(date);
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
    AWAITING_APPROVAL: "bg-purple-100 text-purple-800",
    SEQUENCE_APPROVED: "bg-teal-100 text-teal-800",
  };

  const projectTypeLabels: Record<string, string> = {
    STRAIN_ONLY: "Strain Generation",
    STRAIN_AND_TESTING: "Strain + Testing",
    FULL_SERVICE: "Full Service",
    CONSULTATION: "Consultation",
    PROTEIN_EXPRESSION: "Protein Expression",
  };

  const ProjectCard = ({
    project,
  }: {
    project: (typeof customProjects)[number];
  }) => (
    <div className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-xl font-bold text-gray-800">
            {project.projectName}
          </h3>
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              statusColors[project.status] || "bg-gray-100"
            }`}
          >
            {project.status.replace(/_/g, " ")}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
          {project.projectType && (
            <div>
              <span className="text-gray-500">Type:</span>{" "}
              <span className="font-medium">
                {projectTypeLabels[project.projectType] || project.projectType}
              </span>
            </div>
          )}
          {project.selectedVector && (
            <div>
              <span className="text-gray-500">Vector:</span>{" "}
              <span className="font-medium">{project.selectedVector.name}</span>
            </div>
          )}
          {project.proteins.length > 0 && (
            <div>
              <span className="text-gray-500">Proteins:</span>{" "}
              <span className="font-medium">{project.proteins.length}</span>
            </div>
          )}
          {project.estimatedCost && (
            <div>
              <span className="text-gray-500">Est. Cost:</span>{" "}
              <span className="font-medium">
                {formatPrice(project.estimatedCost)}
              </span>
            </div>
          )}
        </div>
        {project.description && (
          <p className="text-sm text-gray-500 mt-2 line-clamp-1">
            {project.description}
          </p>
        )}
        <p className="text-sm text-gray-500 mt-2">
          Created {formatDate(project.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Link
          href={`/account/dashboard/projects/${project.id}`}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 whitespace-nowrap"
        >
          View Details
        </Link>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/account/dashboard"
            className="text-blue-400 hover:text-blue-300"
          >
            &larr; Back to Dashboard
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-2 text-white drop-shadow-lg">
          Custom Projects
        </h1>
        <p className="text-white/80 mb-8">
          All your custom vector and strain projects are listed below.
        </p>

        {customProjects.length === 0 ? (
          <div className="glass-panel p-12 text-center">
            <p className="text-gray-600 mb-4">
              You don&apos;t have any custom projects yet.
            </p>
            <Link
              href="/services"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Start a Custom Project
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Custom Vectors */}
            {customVectorProjects.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white drop-shadow mb-6">
                  Custom Vectors
                </h2>
                <div className="space-y-4">
                  {customVectorProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </section>
            )}

            {/* Custom Strains */}
            {customStrainProjects.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white drop-shadow mb-6">
                  Custom Strains
                </h2>
                <div className="space-y-4">
                  {customStrainProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </section>
            )}

            {/* Other Projects */}
            {otherProjects.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white drop-shadow mb-6">
                  Other Projects
                </h2>
                <div className="space-y-4">
                  {otherProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
