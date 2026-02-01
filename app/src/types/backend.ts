import type {
  FaceRecognitionResponse,
  FaceRegistrationResponse,
  PersonRemovalResponse,
  PersonUpdateResponse,
  SimilarityThresholdResponse,
  DatabaseStatsResponse,
  PersonInfo,
} from "./recognition";

export interface IBackendAdapter {
  recognizeFace(
    base64Image: string,
    bbox: number[],
    groupId?: string,
    landmarks_5?: number[][],
    enableLivenessDetection?: boolean,
  ): Promise<FaceRecognitionResponse>;

  registerFace(
    imageData: string,
    personId: string,
    bbox: number[],
    groupId?: string,
    enableLivenessDetection?: boolean,
  ): Promise<FaceRegistrationResponse>;

  removePerson(personId: string): Promise<PersonRemovalResponse>;

  updatePerson(
    oldPersonId: string,
    newPersonId: string,
  ): Promise<PersonUpdateResponse>;

  getAllPersons(): Promise<{ persons: PersonInfo[] }>;

  setThreshold(threshold: number): Promise<SimilarityThresholdResponse>;

  clearDatabase(): Promise<{ success: boolean; message: string }>;

  getFaceStats(): Promise<DatabaseStatsResponse>;
}
