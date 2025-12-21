import { CreateDeviceBody, DeviceListItem } from "../schemas/device.js";
import { SuccessResponse } from "../schemas/common.js";
import { createDevice } from "../flow/device-flow.js";

export default async function deviceRoutes(fastify) {
  fastify.post(
    "/create",
    {
      schema: {
        tags: ["device"],
        description: "Register a new device",
        summary: "Create device",
        body: CreateDeviceBody,
        response: {
          201: SuccessResponse(DeviceListItem),
        },
      },
    },
    async (request, reply) => {
      try {
        const deviceData = await createDevice(request, fastify);

        return reply.code(201).send({
          success: true,
          data: {
            deviceId: deviceData.id,
            createdAt: deviceData.createdAt,
          },
        });
      } catch (error) {
        request.log.error(error, "Failed to create device");
        return reply.code(500).send({
          success: false,
          error: "Failed to create device",
          message: error.message,
        });
      }
    }
  );
}
