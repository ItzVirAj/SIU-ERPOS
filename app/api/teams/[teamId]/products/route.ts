import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-server-helpers"
import { db } from "@/lib/db"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await db.teamMember.findFirst({
      where: { teamId, userId },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let products = await db.domainProduct.findMany({
      where: { teamId },
      include: {
        roadmapItems: { orderBy: { createdAt: "asc" } },
        featureRequests: { orderBy: { voteCount: "desc" } },
        pilotCustomers: { orderBy: { createdAt: "desc" } },
        releaseNotes: { orderBy: { releaseDate: "desc" } },
      },
      orderBy: { createdAt: "asc" },
    })

    // Auto-seed starter SaaS domain products if empty for this team
    if (products.length === 0) {
      const p1 = await db.domainProduct.create({
        data: {
          teamId,
          name: "AgriTrack ERP",
          slug: "agritrack-erp",
          tagline: "Farm-to-Market Supply Chain & Harvest Inventory Management",
          description: "End-to-end agribusiness ERP designed for modern Indian FPOs and cold-storage grain distributors. Includes APMC mandi rate sync, batch traceability, and farmer payout automation.",
          vertical: "AGRITECH",
          status: "BETA",
          ownerName: "Founder / Head of Product",
          pricingModel: "SUBSCRIPTION",
          targetQuarter: "Q2_2026",
          websiteUrl: "https://agritrack.sketchitup.io",
          repositoryUrl: "https://github.com/sketchitup/agritrack-core",
          mrr: 45000,
          activeUsers: 140,
          healthScore: 92,
        },
      })

      // Add starter roadmap items
      await db.productRoadmapItem.createMany({
        data: [
          {
            productId: p1.id,
            teamId,
            title: "Mandi Price Live API Ingestion",
            description: "Direct integration with Agmarknet / APMC open APIs for live mandi price ticker per crop state.",
            quarter: "Q1_2026",
            stage: "LIVE",
            priority: "HIGH",
            progress: 100,
            effortEstimate: "3 Sprints",
          },
          {
            productId: p1.id,
            teamId,
            title: "Cold Storage IoT Temperature Logger",
            description: "Connect BLE / Zigbee sensors inside warehouses to trigger SMS alerts when temp spikes above 4°C.",
            quarter: "Q2_2026",
            stage: "IN_DEV",
            priority: "CRITICAL",
            progress: 65,
            effortEstimate: "4 Sprints",
          },
          {
            productId: p1.id,
            teamId,
            title: "Farmer Payouts via UPI Autopay",
            description: "Instant batch disbursement of crop sales proceeds directly to verified farmer bank accounts.",
            quarter: "Q3_2026",
            stage: "PLANNED",
            priority: "HIGH",
            progress: 15,
            effortEstimate: "2 Sprints",
          },
        ],
      })

      // Add feature requests
      await db.productFeatureRequest.createMany({
        data: [
          {
            productId: p1.id,
            teamId,
            title: "Offline Sync Mode for Remote Farm Warehouses",
            description: "Allow warehouse staff to scan grain bags without 4G connectivity and sync upon reconnecting.",
            category: "FEATURE",
            source: "PILOT_CUSTOMER",
            requesterName: "Maharashtra Farmer Producer Co.",
            voteCount: 14,
            status: "IN_ROADMAP",
          },
          {
            productId: p1.id,
            teamId,
            title: "WhatsApp Dispatch Slips for Truck Drivers",
            description: "Auto-send PDF gate passes and delivery receipts directly over WhatsApp Business Cloud API.",
            category: "INTEGRATION",
            source: "SALES_DEMO",
            requesterName: "Apex Agri Logistics",
            voteCount: 9,
            status: "ACCEPTED",
          },
        ],
      })

      // Add pilot customer
      await db.productPilotCustomer.create({
        data: {
          productId: p1.id,
          teamId,
          companyName: "Kisan Unnati Agro Federation",
          contactName: "Rajesh Patil",
          contactEmail: "r.patil@kisanagro.org",
          stage: "PILOT_ACTIVE",
          healthScore: 95,
          feedbackNotes: "Daily weighbridge weigh-ins are 4x faster. Requested multi-crop split billing.",
        },
      })

      // Add release note
      await db.productReleaseNote.create({
        data: {
          productId: p1.id,
          teamId,
          version: "v0.9.4-beta",
          title: "APMC Mandi Price Feeds & Multi-warehouse support",
          isPublished: true,
          features: ["Real-time Agmarknet commodity prices", "Multi-warehouse location inventory toggle"],
          fixes: ["Resolved batch expiry date timezone glitch on Indian IST"],
        },
      })

      // Seed second product: SensorFlow IoT
      const p2 = await db.domainProduct.create({
        data: {
          teamId,
          name: "SensorFlow IoT",
          slug: "sensorflow-iot",
          tagline: "Industrial PLC Telemetry & Predictive Maintenance Platform",
          description: "High-frequency MQTT broker and time-series telemetry engine connecting manufacturing floor machines to executive OEE dashboards.",
          vertical: "INDUSTRIAL",
          status: "DEVELOPMENT",
          ownerName: "Tech Lead / IoT Architect",
          pricingModel: "USAGE_BASED",
          targetQuarter: "Q3_2026",
          websiteUrl: "https://sensorflow.sketchitup.io",
          repositoryUrl: "https://github.com/sketchitup/sensorflow-core",
          mrr: 28000,
          activeUsers: 32,
          healthScore: 88,
        },
      })

      await db.productRoadmapItem.createMany({
        data: [
          {
            productId: p2.id,
            teamId,
            title: "Modbus TCP & MQTT Bridge Agent",
            description: "Lightweight Docker container running on edge Raspberry Pi / IPC for raw PLC register polling.",
            quarter: "Q2_2026",
            stage: "IN_DEV",
            priority: "CRITICAL",
            progress: 80,
            effortEstimate: "3 Sprints",
          },
          {
            productId: p2.id,
            teamId,
            title: "Machine Downtime Root-Cause AI Bot",
            description: "Groq LLaMA-powered natural language prompt answering why Machine Line 3 halted during shift B.",
            quarter: "Q3_2026",
            stage: "PLANNED",
            priority: "MEDIUM",
            progress: 20,
            effortEstimate: "2 Sprints",
          },
        ],
      })

      // Re-fetch seeded products
      products = await db.domainProduct.findMany({
        where: { teamId },
        include: {
          roadmapItems: { orderBy: { createdAt: "asc" } },
          featureRequests: { orderBy: { voteCount: "desc" } },
          pilotCustomers: { orderBy: { createdAt: "desc" } },
          releaseNotes: { orderBy: { releaseDate: "desc" } },
        },
        orderBy: { createdAt: "asc" },
      })
    }

    return NextResponse.json({ products })
  } catch (error) {
    console.error("Error listing products:", error)
    return NextResponse.json({ error: "Failed to list products" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await db.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: { in: ["admin", "developer"] },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Admin or Developer access required" }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      tagline,
      description,
      vertical = "SAAS",
      status = "DEVELOPMENT",
      ownerName,
      pricingModel = "SUBSCRIPTION",
      targetQuarter = "Q3_2026",
      websiteUrl,
      repositoryUrl,
      mrr = 0,
      activeUsers = 0,
    } = body

    if (!name) {
      return NextResponse.json({ error: "Product name is required" }, { status: 400 })
    }

    let slug = slugify(name)
    const existing = await db.domainProduct.findUnique({
      where: { teamId_slug: { teamId, slug } },
    })

    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`
    }

    const product = await db.domainProduct.create({
      data: {
        teamId,
        name,
        slug,
        tagline,
        description,
        vertical,
        status,
        ownerName,
        pricingModel,
        targetQuarter,
        websiteUrl,
        repositoryUrl,
        mrr: Number(mrr) || 0,
        activeUsers: Number(activeUsers) || 0,
      },
    })

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error("Error creating product:", error)
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}
