import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const project = await prisma.customProject.findUnique({
    where: { id },
    include: {
      selectedVector: {
        include: {
          promoter: true,
          selectionMarker: true,
        },
      },
      proteins: {
        orderBy: { sequenceOrder: "asc" },
      },
    },
  });

  if (!project || project.userId !== session.user.id) {
    notFound();
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
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
    STRAIN_ONLY: "Strain Generation Only",
    STRAIN_AND_TESTING: "Strain Generation + Expression Testing",
    FULL_SERVICE: "Full Service",
    CONSULTATION: "Consultation",
    PROTEIN_EXPRESSION: "Protein Expression",
  };

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/account/dashboard/projects"
            className="text-blue-400 hover:text-blue-300"
          >
            &larr; Back to Custom Projects
          </Link>
        </div>

        <div className="glass-panel p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                {project.projectName}
              </h1>
              <p className="text-gray-500 mt-1">
                Created {formatDate(project.createdAt)}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded text-sm font-medium ${
                statusColors[project.status] || "bg-gray-100"
              }`}
            >
              {project.status.replace(/_/g, " ")}
            </span>
          </div>

          {project.description && (
            <p className="text-gray-600 mb-6">{project.description}</p>
          )}

          {/* Project Overview */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Project Overview
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {project.projectType && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Project Type</p>
                  <p className="font-medium text-gray-800">
                    {projectTypeLabels[project.projectType] ||
                      project.projectType.replace(/_/g, " ")}
                  </p>
                </div>
              )}
              {project.estimatedCost && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Estimated Cost</p>
                  <p className="font-medium text-gray-800 text-xl">
                    {formatPrice(project.estimatedCost)}
                  </p>
                </div>
              )}
              {project.estimatedCompletionDate && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">
                    Estimated Completion
                  </p>
                  <p className="font-medium text-gray-800">
                    {formatDate(project.estimatedCompletionDate)}
                  </p>
                </div>
              )}
              {project.deliveryFormat && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Delivery Format</p>
                  <p className="font-medium text-gray-800">
                    {project.deliveryFormat.replace(/_/g, " ")}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Selected Services */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Selected Services
            </h2>
            <div className="flex flex-wrap gap-3">
              {project.strainGeneration && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  Strain Generation
                </span>
              )}
              {project.expressionTesting && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  Expression Testing
                </span>
              )}
              {project.copyNumberDetermination && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                  Copy Number Determination
                </span>
              )}
              {project.glycerolStocks && (
                <span className="px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm">
                  Glycerol Stocks
                </span>
              )}
              {!project.strainGeneration &&
                !project.expressionTesting &&
                !project.copyNumberDetermination &&
                !project.glycerolStocks && (
                  <span className="text-gray-500">No services selected</span>
                )}
            </div>
          </section>

          {/* Selected Vector */}
          {project.selectedVector && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Base Vector
              </h2>
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-2">
                  {project.selectedVector.name}
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  {project.selectedVector.promoter && (
                    <div>
                      <span className="text-gray-500">Promoter:</span>{" "}
                      <span className="font-medium">
                        {project.selectedVector.promoter.name}
                      </span>
                    </div>
                  )}
                  {project.selectedVector.selectionMarker && (
                    <div>
                      <span className="text-gray-500">Selection:</span>{" "}
                      <span className="font-medium">
                        {project.selectedVector.selectionMarker.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Custom Strain Name */}
          {project.customStrainName && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Custom Strain
              </h2>
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-500">Strain Name</p>
                <p className="font-medium text-gray-800">
                  {project.customStrainName}
                </p>
              </div>
            </section>
          )}

          {/* Proteins */}
          {project.proteins.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Proteins ({project.proteins.length})
              </h2>
              <div className="space-y-4">
                {project.proteins.map((protein, index) => (
                  <div
                    key={protein.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-gray-500">
                        #{index + 1}
                      </span>
                      <h3 className="font-bold text-gray-800">{protein.name}</h3>
                      {protein.molecularWeight && (
                        <span className="text-sm text-gray-500">
                          ({protein.molecularWeight.toFixed(1)} kDa)
                        </span>
                      )}
                    </div>
                    {protein.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {protein.description}
                      </p>
                    )}
                    <div className="grid md:grid-cols-3 gap-2 text-sm">
                      {protein.secretionSignal && (
                        <div>
                          <span className="text-gray-500">Secretion Signal:</span>{" "}
                          <span className="font-medium">
                            {protein.secretionSignal}
                          </span>
                        </div>
                      )}
                      {protein.nTerminalTag && (
                        <div>
                          <span className="text-gray-500">N-Terminal Tag:</span>{" "}
                          <span className="font-medium">
                            {protein.nTerminalTag}
                          </span>
                        </div>
                      )}
                      {protein.cTerminalTag && (
                        <div>
                          <span className="text-gray-500">C-Terminal Tag:</span>{" "}
                          <span className="font-medium">
                            {protein.cTerminalTag}
                          </span>
                        </div>
                      )}
                    </div>
                    {protein.aminoAcidSequence && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-500 mb-1">
                          Amino Acid Sequence
                        </p>
                        <div className="bg-gray-50 p-2 rounded font-mono text-xs break-all max-h-24 overflow-y-auto">
                          {protein.aminoAcidSequence}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* DNA Sequence */}
          {project.dnaSequence && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                DNA Sequence
              </h2>
              <div className="flex items-center gap-2 mb-2">
                {project.dnaSequenceApproved ? (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                    Approved
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                    Pending Approval
                  </span>
                )}
              </div>
              <div className="bg-gray-50 p-4 rounded font-mono text-xs break-all max-h-48 overflow-y-auto border">
                {project.dnaSequence}
              </div>
              {project.codonOptimizationNotes && (
                <p className="text-sm text-gray-500 mt-2">
                  <span className="font-medium">Codon Optimization Notes:</span>{" "}
                  {project.codonOptimizationNotes}
                </p>
              )}
            </section>
          )}

          {/* Amino Acid Sequence (if no proteins) */}
          {project.aminoAcidSequence && project.proteins.length === 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Amino Acid Sequence
              </h2>
              <div className="bg-gray-50 p-4 rounded font-mono text-xs break-all max-h-48 overflow-y-auto border">
                {project.aminoAcidSequence}
              </div>
            </section>
          )}

          {/* FASTA File */}
          {project.fastaFileUrl && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                FASTA File
              </h2>
              <div className="flex items-center gap-4">
                <a
                  href={project.fastaFileUrl}
                  download
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Download FASTA File
                </a>
                {project.fastaProcessed ? (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                    Processed
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                    Not Yet Processed
                  </span>
                )}
              </div>
              {project.fastaProcessingNotes && (
                <p className="text-sm text-gray-500 mt-2">
                  {project.fastaProcessingNotes}
                </p>
              )}
            </section>
          )}

          {/* Notes */}
          {project.notes && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Notes</h2>
              <div className="bg-gray-50 p-4 rounded border">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {project.notes}
                </p>
              </div>
            </section>
          )}

          {/* Timeline */}
          <section className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Timeline
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Created</p>
                <p className="text-gray-800">{formatDate(project.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Last Updated</p>
                <p className="text-gray-800">{formatDate(project.updatedAt)}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
