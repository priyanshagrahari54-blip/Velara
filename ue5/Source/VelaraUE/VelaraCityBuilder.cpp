#include "VelaraCityBuilder.h"
#include "Engine/StaticMesh.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/IFileManager.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

AVelaraCityBuilder::AVelaraCityBuilder()
{
	PrimaryActorTick.bCanEverTick = false;

	MeshKinds.Add(TEXT("tower-glass"));
	MeshKinds.Add(TEXT("midrise-concrete"));
	MeshKinds.Add(TEXT("shop-low"));
	MeshKinds.Add(TEXT("shop-enterable"));
	MeshKinds.Add(TEXT("hydrant"));
	MeshKinds.Add(TEXT("drain"));
	MeshKinds.Add(TEXT("bench"));
	MeshKinds.Add(TEXT("meter"));
	MeshKinds.Add(TEXT("sign"));

	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

UInstancedStaticMeshComponent* AVelaraCityBuilder::GetISMFor(const FString& Kind, const FString& MeshPath)
{
	UInstancedStaticMeshComponent** Found = ISMs.Find(Kind);
	if (Found) return *Found;

	UStaticMesh* Mesh = Cast<UStaticMesh>(StaticLoadObject(UStaticMesh::StaticClass(), nullptr, *MeshPath));
	if (!Mesh) return nullptr;

	UInstancedStaticMeshComponent* ISM = NewObject<UInstancedStaticMeshComponent>(this);
	ISM->SetStaticMesh(Mesh);
	ISM->SetCollisionProfileName(TEXT("BlockAll"));
	ISM->RegisterComponent();
	ISM->AttachToComponent(RootComponent, FAttachmentTransformRules::KeepRelativeTransform);
	ISMs.Add(Kind, ISM);
	SpawnedKinds++;
	return ISM;
}

bool AVelaraCityBuilder::BuildFromJson()
{
	// editor + packaged dono: Content/Data pak mein staged hai
	FString JsonPath = FPaths::ProjectContentDir() / TEXT("Data/city_layout.json");
	if (!IFileManager::Get().FileExists(*JsonPath))
	{
		UE_LOG(LogTemp, Error, TEXT("[VelaraCity] city_layout.json missing: %s"), *JsonPath);
		return false;
	}

	FString JsonRaw;
	if (!FFileHelper::LoadFileToString(JsonRaw, *JsonPath))
	{
		return false;
	}

	TSharedRef<TJsonReader<TCHAR>> Reader = FJsonReaderFactory<TCHAR>::Create(JsonRaw);
	TSharedPtr<FJsonObject> Root;
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		UE_LOG(LogTemp, Error, TEXT("[VelaraCity] city_layout.json parse FAIL"));
		return false;
	}

	int32 Count = 0;

	// buildings
	const TArray<TSharedPtr<FJsonValue>>* Buildings;
	if (Root->TryGetArrayField(TEXT("buildings"), Buildings))
	{
		for (const TSharedPtr<FJsonValue>& V : *Buildings)
		{
			TSharedPtr<FJsonObject> O = V->AsObject();
			FString Kind = O->GetStringField(TEXT("kind"));
			double X = O->GetNumberField(TEXT("x"));
			double Z = O->GetNumberField(TEXT("z"));
			double Ry = O->GetNumberField(TEXT("ry"));
			double Sxz = O->HasField(TEXT("sxz")) ? O->GetNumberField(TEXT("sxz")) : 1.0;
			double Sy = O->HasField(TEXT("sy")) ? O->GetNumberField(TEXT("sy")) : 1.0;

			UInstancedStaticMeshComponent* ISM = GetISMFor(Kind, FString::Printf(TEXT("/Game/Meshes/%s.%s"), *Kind, *Kind));
			if (!ISM) continue;
			if (MaxPerKind > 0 && ISM->GetInstanceCount() >= MaxPerKind) continue;

			// three.js (x, height, z) + Y-up yaw -> UE (x, z, y-up) cm-scale (m*100)
			float YawDeg = (bFlipYaw ? -Ry : Ry) * 57.2957795f;
			FTransform Xf(FRotator(0.0f, YawDeg, 0.0f), FVector(X * 100.0f, Z * 100.0f, 0.0f),
				FVector(Sxz, Sy, Sxz));
			ISM->AddInstance(Xf, false);
			Count++;
		}
	}

	// street props
	const TArray<TSharedPtr<FJsonValue>>* Props;
	if (Root->TryGetArrayField(TEXT("props"), Props))
	{
		for (const TSharedPtr<FJsonValue>& V : *Props)
		{
			TSharedPtr<FJsonObject> O = V->AsObject();
			FString Kind = O->GetStringField(TEXT("kind"));
			double X = O->GetNumberField(TEXT("x"));
			double Z = O->GetNumberField(TEXT("z"));
			double Ry = O->HasField(TEXT("ry")) ? O->GetNumberField(TEXT("ry")) : 0.0;

			UInstancedStaticMeshComponent* ISM = GetISMFor(Kind, FString::Printf(TEXT("/Game/Meshes/%s.%s"), *Kind, *Kind));
			if (!ISM) continue;
			if (MaxPerKind > 0 && ISM->GetInstanceCount() >= MaxPerKind) continue;

			float YawDeg = (bFlipYaw ? -Ry : Ry) * 57.2957795f;
			FTransform Xf(FRotator(0.0f, YawDeg, 0.0f), FVector(X * 100.0f, Z * 100.0f, 18.0f), FVector::OneVector);
			ISM->AddInstance(Xf, false);
			Count++;
		}
	}

	SpawnedInstances = Count;
	UE_LOG(LogTemp, Log, TEXT("[VelaraCity] spawned %d instances across %d kinds"), Count, SpawnedKinds);
	return Count > 0;
}

void AVelaraCityBuilder::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	ISMs.Reset();
	SpawnedKinds = 0;
	SpawnedInstances = 0;
#if WITH_EDITOR
	BuildFromJson();   // editor preview (construction script)
#endif
}

void AVelaraCityBuilder::BeginPlay()
{
	Super::BeginPlay();
	ISMs.Reset();
	SpawnedKinds = 0;
	SpawnedInstances = 0;
	BuildFromJson();
}
