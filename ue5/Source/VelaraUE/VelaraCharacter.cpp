#include "VelaraCharacter.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Components/InputComponent.h"
#include "GameFramework/Controller.h"

AVelaraCharacter::AVelaraCharacter()
{
	PrimaryActorTick.bCanEverTick = true;

	// capsule ~ player mesh Phase-2 (SkeletalMesh asset); ab capsule hi kaam karega
	GetCapsuleComponent()->InitCapsuleSize(42.0f, 96.0f);

	bUseControllerRotationYaw = false;

	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->TargetArmLength = 380.0f;
	CameraBoom->SocketOffset = FVector(0.0f, 0.0f, 120.0f);
	CameraBoom->bUsePawnControlRotation = true;
	CameraBoom->bEnableCameraLag = true;
	CameraBoom->CameraLagSpeed = 12.0f;

	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	FollowCamera->bUsePawnControlRotation = false;

	UCharacterMovementComponent* MC = GetCharacterMovement();
	MC->bOrientRotationToMovement = true;
	MC->RotationRate = FRotator(0.0f, 640.0f, 0.0f);
	MC->MaxWalkSpeed = WalkSpeed;
	MC->JumpZVelocity = 520.0f;
	MC->AirControl = 0.25f;
}

void AVelaraCharacter::BeginPlay()
{
	Super::BeginPlay();
}

void AVelaraCharacter::SetupPlayerInputComponent(UInputComponent* PIC)
{
	Super::SetupPlayerInputComponent(PIC);

	PIC->BindAxis("MoveForward", this, &AVelaraCharacter::OnMoveForward);
	PIC->BindAxis("MoveRight", this, &AVelaraCharacter::OnMoveRight);
	PIC->BindAxis("Turn", this, &AVelaraCharacter::OnTurn);
	PIC->BindAxis("LookUp", this, &AVelaraCharacter::OnLookUp);
	PIC->BindAction("Jump", IE_Pressed, this, &ACharacter::Jump);
	PIC->BindAction("Jump", IE_Released, this, &ACharacter::StopJumping);
	PIC->BindAction("Sprint", IE_Pressed, this, &AVelaraCharacter::OnStartSprint);
	PIC->BindAction("Sprint", IE_Released, this, &AVelaraCharacter::OnStopSprint);
}

void AVelaraCharacter::OnMoveForward(float Val)
{
	if (Controller && Val != 0.0f)
	{
		const FRotator YawRot(0.0f, Controller->GetControlRotation().Yaw, 0.0f);
		AddMovementInput(FRotationMatrix(YawRot).GetUnitAxis(EAxis::X), Val);
	}
}

void AVelaraCharacter::OnMoveRight(float Val)
{
	if (Controller && Val != 0.0f)
	{
		const FRotator YawRot(0.0f, Controller->GetControlRotation().Yaw, 0.0f);
		AddMovementInput(FRotationMatrix(YawRot).GetUnitAxis(EAxis::Y), Val);
	}
}

void AVelaraCharacter::OnTurn(float Val)
{
	AddControllerYawInput(Val * 1.6f);
}

void AVelaraCharacter::OnLookUp(float Val)
{
	AddControllerPitchInput(Val * 1.4f);
}

void AVelaraCharacter::OnStartSprint()
{
	GetCharacterMovement()->MaxWalkSpeed = SprintSpeed;
}

void AVelaraCharacter::OnStopSprint()
{
	GetCharacterMovement()->MaxWalkSpeed = WalkSpeed;
}
