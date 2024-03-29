import vec3 from 'gl-vec3';

import { RigidBody } from './rigid-body';

type BrainOptionsType = {
  maxSpeed: number;
  moveForce: number;
  responsiveness: number;
  runningFriction: number;
  standingFriction: number;

  flySpeed: number;
  flyForce: number;
  flyImpulse: number;
  flyInertia: number;

  sprintFactor: number;
  airMoveMult: number;
  jumpImpulse: number;
  jumpForce: number;
  jumpTime: number; // ms
  airJumps: number;
};

type BrainStateType = {
  heading: number; // radians, heading location
  running: boolean;
  jumping: boolean;
  sprinting: boolean;
  crouching: boolean;

  // internal state
  jumpCount: number;
  isJumping: boolean;
  currentJumpTime: number;
};

const defaultBrainOptions: BrainOptionsType = {
  maxSpeed: 6,
  moveForce: 30,
  responsiveness: 240,
  runningFriction: 0.1,
  standingFriction: 4,

  flySpeed: 20,
  flyForce: 60,
  flyImpulse: 0.8,
  flyInertia: 3,

  sprintFactor: 1.4,
  airMoveMult: 0.7,
  jumpImpulse: 8,
  jumpForce: 1,
  jumpTime: 50,
  airJumps: 0,
};

const defaultBrainState: BrainStateType = {
  heading: 0,
  running: false,
  jumping: false,
  sprinting: false,
  crouching: false,

  jumpCount: 0,
  isJumping: false,
  currentJumpTime: 0,
};

class Brain {
  public state: BrainStateType;
  public options: BrainOptionsType;

  private tempVec = vec3.create();
  private zeroVec = vec3.create();
  private tempVec2 = vec3.create();

  constructor(public body: RigidBody, state: Partial<BrainStateType> = {}, options: Partial<BrainOptionsType> = {}) {
    this.state = {
      ...defaultBrainState,
      ...state,
    };

    this.options = {
      ...defaultBrainOptions,
      ...options,
    };
  }

  tick = (dt: number) => {
    // move implementation originally written as external module
    //   see https://github.com/andyhall/voxel-fps-controller
    //   for original code

    if (this.body.gravityMultiplier) {
      // jumping
      const onGround = this.body.atRestY < 0;
      const canjump = onGround || this.state.jumpCount < this.options.airJumps;
      if (onGround) {
        this.state.isJumping = false;
        this.state.jumpCount = 0;
      }

      // process jump input
      if (this.state.jumping) {
        if (this.state.isJumping) {
          // continue previous jump
          if (this.state.currentJumpTime > 0) {
            let jf = this.options.jumpForce;
            if (this.state.currentJumpTime < dt) jf *= this.state.currentJumpTime / dt;
            this.body.applyForce([0, jf, 0]);
            this.state.currentJumpTime -= dt;
          }
        } else if (canjump) {
          // start new jump
          this.state.isJumping = true;
          if (!onGround) this.state.jumpCount++;
          this.state.currentJumpTime = this.options.jumpTime;
          this.body.applyImpulse([0, this.options.jumpImpulse, 0]);
          // clear downward velocity on airjump
          if (!onGround && this.body.velocity[1] < 0) this.body.velocity[1] = 0;
        }
      } else {
        this.state.isJumping = false;
      }

      // apply movement forces if entity is moving, otherwise just friction
      const m = this.tempVec;
      const push = this.tempVec2;
      if (this.state.running) {
        let speed = this.options.maxSpeed;
        // todo: add crouch/sprint modifiers if needed
        if (this.state.sprinting) speed *= this.options.sprintFactor;
        // if (state.crouch) speed *= state.crouchMoveMult
        vec3.set(m, 0, 0, speed);

        // rotate move vector to entity's heading
        vec3.rotateY(m, m, this.zeroVec, this.state.heading);

        // push vector to achieve desired speed & dir
        // following code to adjust 2D velocity to desired amount is patterned on Quake:
        // https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/bg_pmove.c#L275
        vec3.sub(push, m, this.body.velocity);
        push[1] = 0;
        const pushLen = vec3.len(push);
        vec3.normalize(push, push);

        if (pushLen > 0) {
          // pushing force vector
          let canPush = this.options.moveForce;
          if (!onGround) canPush *= this.options.airMoveMult;

          // apply final force
          const pushAmt = this.options.responsiveness * pushLen;
          if (canPush > pushAmt) canPush = pushAmt;

          vec3.scale(push, push, canPush);
          this.body.applyForce(push);
        }

        // different friction when not moving
        // idea from Sonic: http://info.sonicretro.org/SPG:Running
        this.body.friction = this.options.runningFriction;
      } else {
        this.body.friction = this.options.standingFriction;
      }
    } else {
      const flyInertia = this.options.flyInertia;

      this.body.velocity[0] -= this.body.velocity[0] * flyInertia * dt;
      this.body.velocity[1] -= this.body.velocity[1] * flyInertia * dt;
      this.body.velocity[2] -= this.body.velocity[2] * flyInertia * dt;

      if (this.state.jumping) {
        this.body.applyImpulse([0, this.options.flyImpulse, 0]);
      }

      if (this.state.crouching) {
        this.body.applyImpulse([0, -this.options.flyImpulse, 0]);
      }

      // apply movement forces if entity is moving, otherwise just friction
      const m = this.tempVec;
      const push = this.tempVec2;
      if (this.state.running) {
        let speed = this.options.flySpeed;
        // todo: add crouch/sprint modifiers if needed
        if (this.state.sprinting) speed *= this.options.sprintFactor;
        // if (state.crouch) speed *= state.crouchMoveMult
        vec3.set(m, 0, 0, speed);

        // rotate move vector to entity's heading
        vec3.rotateY(m, m, this.zeroVec, this.state.heading);

        // push vector to achieve desired speed & dir
        // following code to adjust 2D velocity to desired amount is patterned on Quake:
        // https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/bg_pmove.c#L275
        vec3.sub(push, m, this.body.velocity);
        push[1] = 0;
        const pushLen = vec3.len(push);
        vec3.normalize(push, push);

        if (pushLen > 0) {
          // pushing force vector
          let canPush = this.options.flyForce;

          // apply final force
          const pushAmt = this.options.responsiveness * pushLen;
          if (canPush > pushAmt) canPush = pushAmt;

          vec3.scale(push, push, canPush);
          this.body.applyForce(push);
        }

        // different friction when not moving
        // idea from Sonic: http://info.sonicretro.org/SPG:Running
        this.body.friction = this.options.runningFriction;
      } else {
        this.body.friction = this.options.standingFriction;
      }
    }
  };
}

export { Brain, BrainOptionsType, BrainStateType };
