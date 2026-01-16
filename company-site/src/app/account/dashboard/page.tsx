import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Fetch purchased vectors (from VectorOrderItems in paid orders)
  const purchasedVectors = await prisma.vectorOrderItem.findMany({
    where: {
      order: {
        userId: session.user.id,
        status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
      },
    },
    include: {
      vector: {
        include: {
          promoter: true,
          selectionMarker: true,
        },
      },
      order: {
        select: {
          orderedAt: true,
          createdAt: true,
          orderNumber: true,
        },
      },
    },
    orderBy: { order: { createdAt: "desc" } },
  });

  // Fetch purchased strains (from StrainOrderItems in paid orders)
  const purchasedStrains = await prisma.strainOrderItem.findMany({
    where: {
      order: {
        userId: session.user.id,
        status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
      },
    },
    include: {
      strain: {
        include: {
          strainType: true,
        },
      },
      order: {
        select: {
          orderedAt: true,
          createdAt: true,
          orderNumber: true,
        },
      },
    },
    orderBy: { order: { createdAt: "desc" } },
  });

  // Fetch custom projects
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

  // Separate custom vectors (projects with selectedVector) and custom strains (STRAIN_ONLY type)
  const customVectorProjects = customProjects.filter(
    (p) => p.selectedVectorId !== null
  );
  const customStrainProjects = customProjects.filter(
    (p) => p.projectType === "STRAIN_ONLY" || p.projectType === "STRAIN_AND_TESTING"
  );

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
    }).format(date);
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
    AWAITING_APPROVAL: "bg-purple-100 text-purple-800",
    SEQUENCE_APPROVED: "bg-teal-100 text-teal-800",
  };

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/account" className="text-blue-400 hover:text-blue-300">
            &larr; Back to Account
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-8 text-white drop-shadow-lg">
          My Dashboard
        </h1>

        {/* Vectors Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white drop-shadow">
              Vectors
            </h2>
            {purchasedVectors.length > 0 && (
              <Link
                href="/account/dashboard/vectors"
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                View all &rarr;
              </Link>
            )}
          </div>

          {purchasedVectors.length === 0 ? (
            <div className="glass-panel p-8 text-center">
              <p className="text-gray-600 mb-4">
                You haven&apos;t purchased any vectors yet.
              </p>
              <Link
                href="/vectors"
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
              >
                Browse Vectors
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {purchasedVectors.slice(0, 3).map((item) => (
                <div key={item.id} className="glass-panel p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">
                    {item.vector.name}
                  </h3>
                  <div className="space-y-1 text-sm text-gray-600 mb-4">
                    {item.vector.promoter && (
                      <p>Promoter: {item.vector.promoter.name}</p>
                    )}
                    {item.vector.selectionMarker && (
                      <p>Selection: {item.vector.selectionMarker.name}</p>
                    )}
                  </div>
                  <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      Purchased {formatDate(item.order.orderedAt || item.order.createdAt)}
                    </span>
                    <Link
                      href={`/account/dashboard/vectors/${item.id}`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Strains Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white drop-shadow">
              Strains
            </h2>
            {purchasedStrains.length > 0 && (
              <Link
                href="/account/dashboard/strains"
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                View all &rarr;
              </Link>
            )}
          </div>

          {purchasedStrains.length === 0 ? (
            <div className="glass-panel p-8 text-center">
              <p className="text-gray-600 mb-4">
                You haven&apos;t purchased any strains yet.
              </p>
              <Link
                href="/strains"
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
              >
                Browse Strains
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {purchasedStrains.slice(0, 3).map((item) => (
                <div key={item.id} className="glass-panel p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">
                    {item.strain.name}
                  </h3>
                  <div className="space-y-1 text-sm text-gray-600 mb-4">
                    {item.strain.strainType && (
                      <p>Type: {item.strain.strainType.name}</p>
                    )}
                    {item.strain.genotype && (
                      <p className="truncate">Genotype: {item.strain.genotype}</p>
                    )}
                  </div>
                  <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      Purchased {formatDate(item.order.orderedAt || item.order.createdAt)}
                    </span>
                    <Link
                      href={`/account/dashboard/strains/${item.id}`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Custom Projects Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white drop-shadow">
              Custom Projects
            </h2>
            {customProjects.length > 0 && (
              <Link
                href="/account/dashboard/projects"
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                View all &rarr;
              </Link>
            )}
          </div>

          {customProjects.length === 0 ? (
            <div className="glass-panel p-8 text-center">
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
            <div className="space-y-8">
              {/* Custom Vectors */}
              {customVectorProjects.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white/90 mb-4">
                    Custom Vectors
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {customVectorProjects.slice(0, 3).map((project) => (
                      <div key={project.id} className="glass-panel p-6">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-lg font-bold text-gray-800">
                            {project.projectName}
                          </h4>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              statusColors[project.status] || "bg-gray-100"
                            }`}
                          >
                            {project.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600 mb-4">
                          {project.selectedVector && (
                            <p>Base Vector: {project.selectedVector.name}</p>
                          )}
                          {project.proteins.length > 0 && (
                            <p>Proteins: {project.proteins.length}</p>
                          )}
                        </div>
                        <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                          <span className="text-xs text-gray-500">
                            Created {formatDate(project.createdAt)}
                          </span>
                          <Link
                            href={`/account/dashboard/projects/${project.id}`}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            Details
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Strains */}
              {customStrainProjects.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white/90 mb-4">
                    Custom Strains
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {customStrainProjects.slice(0, 3).map((project) => (
                      <div key={project.id} className="glass-panel p-6">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-lg font-bold text-gray-800">
                            {project.projectName}
                          </h4>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              statusColors[project.status] || "bg-gray-100"
                            }`}
                          >
                            {project.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600 mb-4">
                          {project.customStrainName && (
                            <p>Strain: {project.customStrainName}</p>
                          )}
                          <p>
                            Type:{" "}
                            {project.projectType?.replace(/_/g, " ") || "Custom"}
                          </p>
                        </div>
                        <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                          <span className="text-xs text-gray-500">
                            Created {formatDate(project.createdAt)}
                          </span>
                          <Link
                            href={`/account/dashboard/projects/${project.id}`}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            Details
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
