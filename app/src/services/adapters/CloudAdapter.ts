import type { IBackendAdapter } from "../../types/backend";
import type {
  FaceRecognitionResponse,
  FaceRegistrationResponse,
  PersonRemovalResponse,
  PersonUpdateResponse,
  SimilarityThresholdResponse,
  DatabaseStatsResponse,
  PersonInfo,
} from "../../types/recognition";

export class CloudAdapter implements IBackendAdapter {
  private baseUrl: string;
  private token: string | null = null; // Future: Auth token

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    method: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `Cloud API Error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  async recognizeFace(
    base64Image: string,
    bbox: number[],
    groupId?: string,
    landmarks_5?: number[][],
    enableLivenessDetection?: boolean,
  ): Promise<FaceRecognitionResponse> {
    return this.request<FaceRecognitionResponse>(
      "/recognition/recognize",
      "POST",
      {
        image: base64Image,
        bbox,
        group_id: groupId,
        landmarks: landmarks_5,
        check_liveness: enableLivenessDetection,
      },
    );
  }

  async registerFace(
    imageData: string,
    personId: string,
    bbox: number[],
    groupId?: string,
    enableLivenessDetection?: boolean,
  ): Promise<FaceRegistrationResponse> {
    return this.request<FaceRegistrationResponse>(
      "/recognition/register",
      "POST",
      {
        image: imageData,
        person_id: personId,
        bbox,
        group_id: groupId,
        check_liveness: enableLivenessDetection,
      },
    );
  }

  async removePerson(personId: string): Promise<PersonRemovalResponse> {
    return this.request<PersonRemovalResponse>(
      `/recognition/person/${personId}`,
      "DELETE",
    );
  }

  async updatePerson(
    oldPersonId: string,
    newPersonId: string,
  ): Promise<PersonUpdateResponse> {
    return this.request<PersonUpdateResponse>(
      "/recognition/person/update",
      "PATCH",
      {
        old_person_id: oldPersonId,
        new_person_id: newPersonId,
      },
    );
  }

  async getAllPersons(): Promise<{ persons: PersonInfo[] }> {
    return this.request<{ persons: PersonInfo[] }>(
      "/recognition/persons",
      "GET",
    );
  }

  async setThreshold(threshold: number): Promise<SimilarityThresholdResponse> {
    return this.request<SimilarityThresholdResponse>(
      "/recognition/threshold",
      "POST",
      {
        threshold,
      },
    );
  }

  async clearDatabase(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      "/admin/database/clear",
      "POST",
    );
  }

  async getFaceStats(): Promise<DatabaseStatsResponse> {
    return this.request<DatabaseStatsResponse>("/admin/stats", "GET");
  }
}
